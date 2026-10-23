package com.linkedin.ai.outreach.controller;

import com.linkedin.ai.outreach.dto.OutreachRequest;
import com.linkedin.ai.outreach.dto.OutreachResponse;
import com.linkedin.ai.outreach.service.LinkedInOutreachService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/linkedin")
public class LinkedInOutreachController {

    private final LinkedInOutreachService outreachService;

    public LinkedInOutreachController(LinkedInOutreachService outreachService) {
        this.outreachService = outreachService;
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> healthCheck() {
        return ResponseEntity.ok(Map.of(
                "status", "UP",
                "service", "linkedin-ai-outreach-backend",
                "port", 8081,
                "timestamp", System.currentTimeMillis()
        ));
    }

    @GetMapping("/playbooks")
    public ResponseEntity<List<Map<String, String>>> getPlaybooks() {
        return ResponseEntity.ok(List.of(
                Map.of("id", "referral", "name", "Job Referral Request", "desc", "Elevator pitch & portfolio hook"),
                Map.of("id", "coffee_chat", "name", "Coffee Chat / Mentorship", "desc", "Low-pressure question on their experience"),
                Map.of("id", "founder_b2b", "name", "Founder / B2B Outreach", "desc", "Identifies pain point with soft demo ask"),
                Map.of("id", "follow_up", "name", "Warm Follow-Up", "desc", "Zero-pressure bump after 3-5 days"),
                Map.of("id", "contextual_reply", "name", "Smart Chat Reply", "desc", "Direct reply to incoming message")
        ));
    }

    @PostMapping("/generate")
    public ResponseEntity<OutreachResponse> generateOutreach(@RequestBody OutreachRequest request) {
        if (request == null) {
            return ResponseEntity.badRequest().body(OutreachResponse.error("Request body cannot be null"));
        }
        OutreachResponse response = outreachService.generateOutreach(request);
        return ResponseEntity.ok(response);
    }
}
