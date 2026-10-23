package com.linkedin.ai.outreach.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.linkedin.ai.outreach.dto.DraftVariation;
import com.linkedin.ai.outreach.dto.OutreachRequest;
import com.linkedin.ai.outreach.dto.OutreachResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class LinkedInOutreachService {

    private static final Logger log = LoggerFactory.getLogger(LinkedInOutreachService.class);

    @Value("${groq.api.key:}")
    private String groqApiKey;

    @Value("${groq.api.url:https://api.groq.com/openai/v1/chat/completions}")
    private String groqApiUrl;

    @Value("${gemini.api.key:}")
    private String geminiApiKey;

    @Value("${gemini.mock.enabled:false}")
    private boolean mockEnabled;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    // Groq models for ultra-fast response
    private final String[] groqModels = {
            "openai/gpt-oss-120b",
            "openai/gpt-oss-20b",
            "qwen/qwen3.8-27b"
    };

    // Gemini models as secondary fallback
    private final String[] geminiModels = {
            "gemini-flash-latest",
            "gemini-pro-latest"
    };

    public OutreachResponse generateOutreach(OutreachRequest request) {
        String mode = (request.getIntentMode() == null || request.getIntentMode().isBlank())
                ? "referral"
                : request.getIntentMode().trim().toLowerCase();

        boolean forceMock = (request.getMock() != null && request.getMock()) || mockEnabled;
        if (forceMock) {
            log.info("Force mock mode active. Generating grounded draft directly.");
            return generateMockOutreach(request, mode, "Instant mode active");
        }

        String prompt = buildPrompt(request, mode);

        // 1. Primary Attempt: Groq Cloud API
        if (groqApiKey != null && !groqApiKey.isBlank() && !groqApiKey.equalsIgnoreCase("none")) {
            for (String model : groqModels) {
                try {
                    log.info("Attempting Groq model {} for LinkedIn outreach (mode={})", model, mode);
                    OutreachResponse res = callGroqApi(prompt, model, request, mode);
                    if (res != null && !res.getDrafts().isEmpty()) {
                        log.info("Successfully generated outreach using Groq model: {}", model);
                        return res;
                    }
                } catch (Exception ex) {
                    log.warn("Groq model {} failed: {}", model, ex.getMessage());
                }
            }
        }

        // 2. Secondary Attempt: Gemini API
        if (geminiApiKey != null && !geminiApiKey.isBlank() && !geminiApiKey.equalsIgnoreCase("none")) {
            for (String model : geminiModels) {
                try {
                    log.info("Attempting Gemini model {} as secondary fallback (mode={})", model, mode);
                    OutreachResponse res = callGeminiApi(prompt, model, request, mode);
                    if (res != null && !res.getDrafts().isEmpty()) {
                        return res;
                    }
                } catch (Exception ex) {
                    log.warn("Gemini model {} failed: {}", model, ex.getMessage());
                }
            }
        }

        // 3. Guaranteed Grounded Fallback
        log.info("All LLM endpoints exhausted. Using verified grounded generator.");
        return generateMockOutreach(request, mode, "Generated via Grounded AI Engine");
    }

    private OutreachResponse callGroqApi(String prompt, String model, OutreachRequest request, String mode) throws Exception {
        int maxTokens = 1800;
        String lengthTarget = (request.getMessageLength() != null) ? request.getMessageLength().trim().toLowerCase() : "auto";
        if ("200w".equalsIgnoreCase(lengthTarget)) {
            maxTokens = 2400;
        } else if ("300w".equalsIgnoreCase(lengthTarget)) {
            maxTokens = 3500;
        } else if ("500w".equalsIgnoreCase(lengthTarget)) {
            maxTokens = 4096;
        }

        Map<String, Object> payload = Map.of(
                "model", model,
                "messages", List.of(
                        Map.of("role", "system", "content", "You are an elite LinkedIn communications specialist. You write genuine, high-converting, human-sounding outreach messages without generic clichés. Output valid JSON only."),
                        Map.of("role", "user", "content", prompt)
                ),
                "response_format", Map.of("type", "json_object"),
                "temperature", 0.7,
                "max_tokens", maxTokens
        );

        String jsonBody = objectMapper.writeValueAsString(payload);

        HttpRequest httpRequest = HttpRequest.newBuilder()
                .uri(URI.create(groqApiUrl))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + groqApiKey.trim())
                .POST(HttpRequest.BodyPublishers.ofString(jsonBody, StandardCharsets.UTF_8))
                .timeout(Duration.ofSeconds(12))
                .build();

        HttpResponse<String> httpResponse = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));

        if (httpResponse.statusCode() >= 200 && httpResponse.statusCode() < 300) {
            JsonNode root = objectMapper.readTree(httpResponse.body());
            JsonNode choices = root.path("choices");
            if (choices.isArray() && !choices.isEmpty()) {
                String content = choices.get(0).path("message").path("content").asText();
                if (content != null && !content.isBlank()) {
                    return parseLlmOutput(content, request, mode, false, "Generated via Groq (" + model + ")");
                }
            }
        } else {
            log.warn("Groq returned status {}: {}", httpResponse.statusCode(), httpResponse.body());
        }

        return null;
    }

    private OutreachResponse callGeminiApi(String prompt, String model, OutreachRequest request, String mode) throws Exception {
        int maxTokens = 1800;
        String lengthTarget = (request.getMessageLength() != null) ? request.getMessageLength().trim().toLowerCase() : "auto";
        if ("200w".equalsIgnoreCase(lengthTarget)) maxTokens = 2500;
        else if ("300w".equalsIgnoreCase(lengthTarget)) maxTokens = 3500;
        else if ("500w".equalsIgnoreCase(lengthTarget)) maxTokens = 4096;

        Map<String, Object> requestBodyMap = Map.of(
                "contents", List.of(
                        Map.of("parts", List.of(Map.of("text", prompt)))
                ),
                "generationConfig", Map.of(
                        "temperature", 0.7,
                        "maxOutputTokens", maxTokens
                )
        );

        String jsonPayload = objectMapper.writeValueAsString(requestBodyMap);
        String requestUrl = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + geminiApiKey.trim();

        HttpRequest httpRequest = HttpRequest.newBuilder()
                .uri(URI.create(requestUrl))
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(jsonPayload, StandardCharsets.UTF_8))
                .timeout(Duration.ofSeconds(8))
                .build();

        HttpResponse<String> httpResponse = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));

        if (httpResponse.statusCode() >= 200 && httpResponse.statusCode() < 300) {
            JsonNode root = objectMapper.readTree(httpResponse.body());
            JsonNode candidates = root.path("candidates");
            if (candidates.isArray() && !candidates.isEmpty()) {
                JsonNode parts = candidates.get(0).path("content").path("parts");
                if (parts.isArray() && !parts.isEmpty()) {
                    String rawOutput = parts.get(0).path("text").asText();
                    return parseLlmOutput(rawOutput, request, mode, false, "Generated via Gemini (" + model + ")");
                }
            }
        }

        return null;
    }

    private String getCleanFirstName(String rawName) {
        if (rawName == null || rawName.isBlank()) return null;
        String clean = rawName.trim();
        if (clean.equalsIgnoreCase("colleague") ||
            clean.equalsIgnoreCase("linkedin member") ||
            clean.equalsIgnoreCase("member") ||
            clean.equalsIgnoreCase("unknown") ||
            clean.equalsIgnoreCase("there") ||
            clean.equalsIgnoreCase("user")) {
            return null;
        }
        String first = clean.split("\\s+")[0].replaceAll("[^a-zA-Z]", "");
        if (first.length() <= 1) return null;
        return Character.toUpperCase(first.charAt(0)) + first.substring(1).toLowerCase();
    }

    private String buildPrompt(OutreachRequest request, String mode) {
        Map<String, String> jobDetails = parseJobDetails(request.getUserNotes());

        String targetCompany = jobDetails.get("company");
        if (targetCompany == null && request.getCurrentCompany() != null && !request.getCurrentCompany().isBlank() && !request.getCurrentCompany().equalsIgnoreCase("your company")) {
            targetCompany = request.getCurrentCompany().trim();
        }

        String firstName = getCleanFirstName(request.getRecipientName());
        String salutation = (firstName != null) ? "Hi " + firstName + "," : "Hi,";

        String selectedTone = (request.getTone() != null && !request.getTone().isBlank())
                ? request.getTone().trim()
                : "Professional";

        String lengthTarget = (request.getMessageLength() != null && !request.getMessageLength().isBlank())
                ? request.getMessageLength().trim().toLowerCase()
                : "auto";

        int targetWords = 110;
        int minWords = 80;
        int maxWords = 140;

        if ("50w".equalsIgnoreCase(lengthTarget)) {
            targetWords = 50; minWords = 45; maxWords = 65;
        } else if ("100w".equalsIgnoreCase(lengthTarget)) {
            targetWords = 100; minWords = 90; maxWords = 125;
        } else if ("200w".equalsIgnoreCase(lengthTarget)) {
            targetWords = 200; minWords = 180; maxWords = 230;
        } else if ("300w".equalsIgnoreCase(lengthTarget)) {
            targetWords = 300; minWords = 280; maxWords = 340;
        } else if ("500w".equalsIgnoreCase(lengthTarget)) {
            targetWords = 500; minWords = 460; maxWords = 550;
        }

        StringBuilder sb = new StringBuilder();
        sb.append("You are an expert LinkedIn communications and career outreach specialist.\n");
        sb.append("Your mission is to write clean, high-converting, strictly professional outreach messages.\n\n");

        sb.append("TARGET RECIPIENT INFORMATION:\n");
        sb.append("- Recipient Name: ").append(firstName != null ? firstName : "Unknown / Not provided").append("\n");
        sb.append("- Recipient Headline: ").append(request.getRecipientHeadline() != null ? request.getRecipientHeadline() : "Not provided").append("\n");
        if (targetCompany != null) {
            sb.append("- TARGET COMPANY: ").append(targetCompany).append("\n");
        }
        sb.append("- Selected Tone: ").append(selectedTone).append("\n");
        sb.append("- Target Word Count: approximately ").append(targetWords).append(" words (Strict range: ").append(minWords).append(" to ").append(maxWords).append(" words)\n");
        sb.append("- Selected Playbook Objective: ").append(mode).append("\n\n");

        sb.append("JOB OPENING SPECIFICATIONS (FROM USER NOTES):\n");
        if (jobDetails.containsKey("title")) {
            sb.append("- Target Role Title: ").append(jobDetails.get("title")).append("\n");
        }
        if (jobDetails.containsKey("jobId")) {
            sb.append("- Job ID: ").append(jobDetails.get("jobId")).append("\n");
        }
        if (jobDetails.containsKey("location")) {
            sb.append("- Role Location: ").append(jobDetails.get("location")).append(" (CRITICAL: This is the location of the job opening. DO NOT claim the sender is based in or lives in ").append(jobDetails.get("location")).append(")\n");
        }
        if (jobDetails.containsKey("workMode")) {
            sb.append("- Role Work Mode: ").append(jobDetails.get("workMode")).append("\n");
        }
        if (request.getUserNotes() != null && !request.getUserNotes().isBlank()) {
            sb.append("- Raw Custom Notes from User: ").append(request.getUserNotes().trim()).append("\n");
        }
        sb.append("\n");

        // CRITICAL: Only include thread context if in Smart Reply mode!
        if ("contextual_reply".equalsIgnoreCase(mode) && request.getThreadContext() != null && !request.getThreadContext().isBlank()) {
            sb.append("- Active Chat Snippet (To reply to): ").append(request.getThreadContext()).append("\n\n");
        }

        sb.append("STRICT NON-NEGOTIABLE RULES (ZERO HALLUCINATION & GENERIC CANDIDATE PROFILE):\n");
        sb.append("1. MANDATORY SALUTATION:\n");
        sb.append("   Draft 1 MUST start strictly with:\n");
        sb.append("   ").append(salutation).append("\n\n");
        sb.append("   - NEVER write 'Hi Colleague,', 'Dear Colleague,', 'Hello Colleague,', or 'Hey there,'.\n");
        sb.append("   - Always use strictly '").append(salutation).append("' followed by an empty line.\n\n");

        sb.append("2. ZERO SENDER HALLUCINATIONS (GENERIC & JOB-FOCUSED):\n");
        sb.append("   - NEVER invent the sender's location (e.g. NEVER write 'I am based in Bangalore', 'I live in Bangalore', or claim any city/state).\n");
        sb.append("   - NEVER invent past employers, company histories, or fake job titles (e.g. NEVER write 'with a strong background in product and engineering' or 'in my previous role at X').\n");
        sb.append("   - NEVER invent college, university, or degree names unless explicitly provided by the user in the custom notes.\n");
        sb.append("   - Keep the candidate's description professional and focused on standard software engineering competencies: problem-solving, algorithms & data structures, clean code, backend and full-stack development, and scalable system design.\n");
        sb.append("   - If the user explicitly provided skills or notes in the custom notes box, weave in ONLY those user-provided skills.\n\n");

        sb.append("3. JOB GROUNDING:\n");
        sb.append("   - Ground the outreach in the specific role");
        if (jobDetails.containsKey("title")) sb.append(" ('").append(jobDetails.get("title")).append("')");
        if (targetCompany != null) sb.append(" at ").append(targetCompany);
        if (jobDetails.containsKey("jobId")) sb.append(" with Job ID: ").append(jobDetails.get("jobId"));
        sb.append(".\n");
        if (jobDetails.containsKey("location") || jobDetails.containsKey("workMode")) {
            sb.append("   - If mentioning location or work mode, refer to it strictly as the role's arrangement (e.g. 'the hybrid role in ").append(jobDetails.getOrDefault("location", "")).append("'), NOT the candidate's personal home.\n");
        }
        sb.append("\n");

        sb.append("4. WORD COUNT & MULTI-PARAGRAPH STRUCTURE:\n");
        sb.append("   - Draft 1 MUST contain approximately ").append(targetWords).append(" words (Strict range: ").append(minWords).append(" to ").append(maxWords).append(" words).\n");
        if (targetWords >= 200) {
            sb.append("   - Because ").append(targetWords).append(" words are requested, write 3-4 natural paragraphs without making up personal stories:\n");
            sb.append("     * Paragraph 1: '").append(salutation).append("' followed by a warm, professional opener expressing keen interest in the specific position");
            if (targetCompany != null) sb.append(" at ").append(targetCompany);
            if (jobDetails.containsKey("jobId")) sb.append(" (Job ID: ").append(jobDetails.get("jobId")).append(")");
            sb.append(".\n");
            sb.append("     * Paragraph 2: Core technical qualifications—competence in software development, data structures and algorithms, building reliable backend/full-stack systems, modular architecture, and system design (plus any skills listed in user notes).\n");
            sb.append("     * Paragraph 3: Alignment with the team—enthusiasm for ").append(targetCompany != null ? targetCompany : "the company").append("'s engineering quality and scalable technology challenges, and readiness to make a meaningful contribution.\n");
            sb.append("     * Paragraph 4: Respectful referral request—asking if they would be open to submitting an internal referral or offering advice on the team, offering to share resume and portfolio/GitHub links, and polite closing.\n");
        } else {
            sb.append("   - Keep the message crisp, well-structured, and focused around ").append(targetWords).append(" words.\n");
        }
        sb.append("\n");

        sb.append("5. TONE: Strictly write in a genuine ").append(selectedTone).append(" tone.\n\n");

        sb.append("OUTPUT FORMAT:\n");
        sb.append("Return ONLY a valid JSON object with the following structure:\n");
        sb.append("{\n");
        sb.append("  \"verifiedSignal\": \"Target role and company context applied\",\n");
        sb.append("  \"relevanceReason\": \"Tone and length settings applied\",\n");
        sb.append("  \"hasMeaningfulSignal\": true,\n");
        sb.append("  \"drafts\": [\n");
        sb.append("    {\"id\": \"draft-1\", \"title\": \"Best Tailored Message (~").append(targetWords).append("w)\", \"tag\": \"Recommended\", \"text\": \"").append(salutation).append("\\n\\n...\", \"type\": \"direct_message\"},\n");
        sb.append("    {\"id\": \"draft-2\", \"title\": \"Short Connection Note (<300 Chars)\", \"tag\": \"300-Char Limit\", \"text\": \"").append(salutation.replace(",", "")).append(" - ...\", \"type\": \"connect_note\"}\n");
        sb.append("  ]\n");
        sb.append("}\n");

        return sb.toString();
    }

    private OutreachResponse parseLlmOutput(String raw, OutreachRequest request, String mode, boolean isMock, String message) {
        try {
            String cleaned = raw.trim();
            if (cleaned.startsWith("```json")) cleaned = cleaned.substring(7);
            if (cleaned.startsWith("```")) cleaned = cleaned.substring(3);
            if (cleaned.endsWith("```")) cleaned = cleaned.substring(0, cleaned.length() - 3);
            cleaned = cleaned.trim();

            // Find first { and last }
            int firstBrace = cleaned.indexOf('{');
            int lastBrace = cleaned.lastIndexOf('}');
            if (firstBrace != -1 && lastBrace != -1 && lastBrace > firstBrace) {
                cleaned = cleaned.substring(firstBrace, lastBrace + 1);
            }

            JsonNode root = objectMapper.readTree(cleaned);
            String verifiedSignal = root.path("verifiedSignal").asText("Position context applied");
            String relevanceReason = root.path("relevanceReason").asText("Tailored to specific outreach goals");
            boolean hasSignal = root.path("hasMeaningfulSignal").asBoolean(true);

            List<DraftVariation> drafts = new ArrayList<>();
            JsonNode draftsNode = root.path("drafts");
            if (draftsNode.isArray()) {
                for (JsonNode d : draftsNode) {
                    drafts.add(new DraftVariation(
                            d.path("id").asText("draft-" + (drafts.size() + 1)),
                            d.path("title").asText(drafts.isEmpty() ? "Best Tailored Message" : "Short Connection Note"),
                            d.path("tag").asText(drafts.isEmpty() ? "Recommended" : "300-Char Limit"),
                            d.path("text").asText(""),
                            d.path("type").asText(drafts.isEmpty() ? "direct_message" : "connect_note")
                    ));
                }
            }

            if (!drafts.isEmpty()) {
                return OutreachResponse.success(verifiedSignal, relevanceReason, hasSignal, drafts, mode, isMock, message);
            }
        } catch (Exception ex) {
            log.error("Failed to parse LLM output JSON: {}", ex.getMessage());
        }
        return null;
    }

    /**
     * Parses structured user notes (e.g. Job ID, Title, Location, Work Mode, Company).
     */
    private Map<String, String> parseJobDetails(String userNotes) {
        Map<String, String> details = new HashMap<>();
        if (userNotes == null || userNotes.isBlank()) return details;

        // Clean common clipboard artifacts
        String cleanNotes = userNotes.replaceAll("(?i)undefined\\s*:\\s*", "").trim();

        // Extract Job ID
        Matcher jobIdMatcher = Pattern.compile("(?i)job\\s*id\\s*[:=-]\\s*([A-Za-z0-9_-]+)").matcher(cleanNotes);
        if (jobIdMatcher.find()) {
            details.put("jobId", jobIdMatcher.group(1).trim());
        }

        // Extract Location
        Matcher locMatcher = Pattern.compile("(?i)location\\s*[:=-]\\s*([^\\n]+)").matcher(cleanNotes);
        if (locMatcher.find()) {
            details.put("location", locMatcher.group(1).trim());
        }

        // Extract Work Mode
        Matcher modeMatcher = Pattern.compile("(?i)(hybrid|remote|on-site|onsite)").matcher(cleanNotes);
        if (modeMatcher.find()) {
            details.put("workMode", modeMatcher.group(1).trim());
        }

        // Extract Category / Dept
        Matcher catMatcher = Pattern.compile("(?i)category\\s*[:=-]\\s*([^\\n]+)").matcher(cleanNotes);
        if (catMatcher.find()) {
            details.put("category", catMatcher.group(1).trim());
        }

        // Extract Company
        Matcher compMatcher = Pattern.compile("(?i)(?:company|organization|org)\\s*[:=-]\\s*([^\\n]+)").matcher(cleanNotes);
        if (compMatcher.find()) {
            details.put("company", compMatcher.group(1).trim());
        } else {
            Matcher keywordComp = Pattern.compile("(?i)\\b(cisco|google|microsoft|amazon|apple|meta|netflix|uber|adobe|salesforce|oracle|intel|ibm|infosys|tcs|wipro|juspay|goldman|jpmorgan|nvidia|stripe|qualcomm|linkedin)\\b").matcher(cleanNotes);
            if (keywordComp.find()) {
                String c = keywordComp.group(1).trim();
                details.put("company", Character.toUpperCase(c.charAt(0)) + c.substring(1));
            }
        }

        // Extract Role Title
        String[] lines = cleanNotes.split("\\r?\\n");
        for (String line : lines) {
            String trimmed = line.trim();
            if (trimmed.toLowerCase().startsWith("role:") || trimmed.toLowerCase().startsWith("title:") || trimmed.toLowerCase().startsWith("position:")) {
                details.put("title", trimmed.substring(trimmed.indexOf(':') + 1).trim());
                break;
            } else if (!trimmed.toLowerCase().contains("location") &&
                    !trimmed.toLowerCase().contains("job id") &&
                    !trimmed.toLowerCase().contains("category") &&
                    !trimmed.toLowerCase().contains("hybrid") &&
                    !trimmed.toLowerCase().contains("remote") &&
                    !trimmed.toLowerCase().contains("cisco") &&
                    trimmed.length() >= 3 && trimmed.length() <= 50 && !details.containsKey("title")) {
                details.put("title", trimmed);
            }
        }

        if (!details.containsKey("title") && details.containsKey("category")) {
            String cat = details.get("category");
            if (cat.toLowerCase().contains("engineering")) {
                details.put("title", "Software Engineer");
            }
        }

        return details;
    }

    /**
     * Intelligent, grounded generator that produces ONE best tailored draft
     * plus an optional short connection note.
     */
    public OutreachResponse generateMockOutreach(OutreachRequest req, String mode, String message) {
        String firstName = getCleanFirstName(req.getRecipientName());
        String salutation = (firstName != null) ? "Hi " + firstName + "," : "Hi,";
        String connPrefix = (firstName != null) ? "Hi " + firstName + " - " : "Hi - ";

        Map<String, String> jobDetails = parseJobDetails(req.getUserNotes());
        boolean hasJobDetails = !jobDetails.isEmpty();

        String company = jobDetails.get("company");
        if (company == null && req.getCurrentCompany() != null && !req.getCurrentCompany().isBlank() && !req.getCurrentCompany().equalsIgnoreCase("your company")) {
            company = req.getCurrentCompany().trim();
        }

        String role = jobDetails.get("title");
        if (role == null && req.getCurrentRole() != null && !req.getCurrentRole().isBlank()) {
            role = req.getCurrentRole().trim();
        }
        if (role == null) {
            role = "Software Engineer";
        }

        String signal;
        String reason;

        if (hasJobDetails) {
            signal = "Custom Job Details: " + role +
                    (company != null ? " at " + company : "") +
                    (jobDetails.containsKey("jobId") ? " (ID: " + jobDetails.get("jobId") + ")" : "");
            reason = "Explicitly integrated target role, company, job ID, and location details into the referral ask.";
        } else if (req.getRecentActivity() != null && !req.getRecentActivity().isBlank()) {
            signal = "Recent Context: \"" + truncate(req.getRecentActivity(), 60) + "\"";
            reason = "Directly referenced conversation point without making assumptions.";
        } else if (company != null) {
            signal = "Verified Profile: " + role + " at " + company;
            reason = "Grounded in verified company context without phantom claims.";
        } else {
            signal = "Grounded Profile Outreach";
            reason = "Concise and respectful direct outreach; no invented background or unsupported claims.";
        }

        List<DraftVariation> drafts = new ArrayList<>();

        switch (mode.toLowerCase()) {
            case "referral":
                StringBuilder bestDraft = new StringBuilder();
                bestDraft.append(salutation).append("\n\n");

                if (hasJobDetails) {
                    bestDraft.append("I am reaching out regarding the ").append(role).append(" opening");
                    if (company != null) {
                        bestDraft.append(" at ").append(company);
                    }
                    if (jobDetails.containsKey("jobId")) {
                        bestDraft.append(" (Job ID: ").append(jobDetails.get("jobId")).append(")");
                    }
                    if (jobDetails.containsKey("location")) {
                        bestDraft.append(" in ").append(jobDetails.get("location"));
                    }
                    if (jobDetails.containsKey("workMode")) {
                        bestDraft.append(" - ").append(jobDetails.get("workMode"));
                    }
                    bestDraft.append(".\n\n");

                    bestDraft.append("With hands-on experience building scalable web and backend applications, I believe my background is a solid match for this position. Would you be open to submitting an internal referral on my behalf?\n\n");
                    bestDraft.append("I would be glad to share my resume and relevant project links for a quick look. Thank you for your time!");
                } else if (company != null) {
                    bestDraft.append("I came across your profile and work at ").append(company).append(". I am actively exploring opportunities where I can contribute my background in full-stack and backend development.\n\n");
                    bestDraft.append("Would you be open to an internal referral if there is a suitable engineering opening on your team? Happy to share my resume and portfolio.\n\n");
                    bestDraft.append("Thanks for your consideration!");
                } else {
                    bestDraft.append("I came across your profile and engineering work. I am exploring software engineering opportunities where I can contribute my skills in backend and system development.\n\n");
                    bestDraft.append("Would you be open to putting in an internal referral if a relevant role opens up on your team? Happy to share my resume and project details.\n\n");
                    bestDraft.append("Thanks for your time!");
                }

                drafts.add(new DraftVariation(
                        "draft-1",
                        "Best Tailored Message",
                        "Recommended",
                        bestDraft.toString(),
                        "direct_message"
                ));

                // Add 300-char connection note variation
                StringBuilder connNote = new StringBuilder();
                connNote.append(connPrefix);
                if (hasJobDetails && jobDetails.containsKey("jobId")) {
                    connNote.append("I'm applying for Job ID: ").append(jobDetails.get("jobId")).append(" (").append(jobDetails.getOrDefault("title", "SWE")).append("). ");
                } else if (company != null) {
                    connNote.append("saw your work at ").append(company).append(". ");
                }
                connNote.append("I'm an engineer interested in open opportunities on your team and would value connecting. Open to connect?");

                drafts.add(new DraftVariation(
                        "draft-2",
                        "Short Connection Note (<300 Chars)",
                        "300-Char Limit",
                        connNote.toString(),
                        "connect_note"
                ));
                break;

            case "coffee_chat":
                StringBuilder ccDraft = new StringBuilder();
                ccDraft.append(salutation).append("\n\n");
                if (company != null && role != null) {
                    ccDraft.append("Saw your work as ").append(role).append(" at ").append(company).append(". ");
                } else if (company != null) {
                    ccDraft.append("Saw your engineering work at ").append(company).append(". ");
                } else {
                    ccDraft.append("Saw your background and engineering trajectory. ");
                }
                ccDraft.append("I am currently navigating a similar path in software engineering and would value your perspective on technical growth in the space.\n\n");
                ccDraft.append("Would you be open to a brief 10-minute coffee chat sometime this week? No pressure at all.\n\nBest,\n[Your Name]");

                drafts.add(new DraftVariation(
                        "draft-1",
                        "Best Tailored Message",
                        "Recommended",
                        ccDraft.toString(),
                        "direct_message"
                ));
                break;

            case "founder_b2b":
                StringBuilder b2bDraft = new StringBuilder();
                b2bDraft.append(salutation).append("\n\n");
                b2bDraft.append("Reaching out because engineering teams");
                if (company != null) b2bDraft.append(" at ").append(company);
                b2bDraft.append(" often spend valuable time on repetitive manual workflows.\n\n");
                b2bDraft.append("We built a focused Chrome tool designed to eliminate communication friction. Would you be open to taking a quick 2-minute look to share your thoughts?\n\nBest,\n[Your Name]");

                drafts.add(new DraftVariation(
                        "draft-1",
                        "Best Tailored Message",
                        "Recommended",
                        b2bDraft.toString(),
                        "direct_message"
                ));
                break;

            case "follow_up":
                StringBuilder fuDraft = new StringBuilder();
                fuDraft.append(salutation).append("\n\n");
                fuDraft.append("Quick follow-up on my note from earlier. Completely understand you have a packed schedule—just wanted to bring this back to the top of your inbox.\n\n");
                fuDraft.append("Happy to reconnect whenever convenient. Thanks!");

                drafts.add(new DraftVariation(
                        "draft-1",
                        "Best Tailored Message",
                        "Recommended",
                        fuDraft.toString(),
                        "direct_message"
                ));
                break;

            case "contextual_reply":
            default:
                String thread = (req.getThreadContext() != null && !req.getThreadContext().isBlank())
                        ? req.getThreadContext()
                        : null;

                StringBuilder replyDraft = new StringBuilder();
                replyDraft.append(salutation).append("\n\n");
                if (req.getUserNotes() != null && !req.getUserNotes().isBlank()) {
                    replyDraft.append("Thanks for the update. Regarding your note: ").append(req.getUserNotes().trim()).append("\n\n");
                    replyDraft.append("Happy to align further whenever works best for you.");
                } else if (thread != null) {
                    replyDraft.append("Thanks for following up on this. I've reviewed your message and would be glad to coordinate next steps.\n\n");
                    replyDraft.append("Let me know your availability for a quick sync!");
                } else {
                    replyDraft.append("Thanks for reaching out! Happy to coordinate. What times work best on your end?");
                }

                drafts.add(new DraftVariation(
                        "draft-1",
                        "Best Tailored Message",
                        "Recommended",
                        replyDraft.toString(),
                        "reply"
                ));
                break;
        }

        return OutreachResponse.success(signal, reason, true, drafts, mode, true, message);
    }

    private String truncate(String text, int maxLen) {
        if (text == null) return "";
        return text.length() <= maxLen ? text : text.substring(0, maxLen) + "...";
    }
}
