package com.linkedin.ai.outreach.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.ArrayList;
import java.util.List;

public class OutreachResponse {
    private boolean success;
    private String verifiedSignal;
    private String relevanceReason;
    private boolean hasMeaningfulSignal;
    private List<DraftVariation> drafts = new ArrayList<>();
    private String intentMode;
    private boolean isMock;
    private String message;
    private String error;

    public OutreachResponse() {}

    public static OutreachResponse success(
            String verifiedSignal,
            String relevanceReason,
            boolean hasMeaningfulSignal,
            List<DraftVariation> drafts,
            String intentMode,
            boolean isMock,
            String message) {
        OutreachResponse resp = new OutreachResponse();
        resp.setSuccess(true);
        resp.setVerifiedSignal(verifiedSignal);
        resp.setRelevanceReason(relevanceReason);
        resp.setHasMeaningfulSignal(hasMeaningfulSignal);
        resp.setDrafts(drafts);
        resp.setIntentMode(intentMode);
        resp.setMock(isMock);
        resp.setMessage(message);
        return resp;
    }

    public static OutreachResponse error(String error) {
        OutreachResponse resp = new OutreachResponse();
        resp.setSuccess(false);
        resp.setError(error);
        return resp;
    }

    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }

    public String getVerifiedSignal() { return verifiedSignal; }
    public void setVerifiedSignal(String verifiedSignal) { this.verifiedSignal = verifiedSignal; }

    public String getRelevanceReason() { return relevanceReason; }
    public void setRelevanceReason(String relevanceReason) { this.relevanceReason = relevanceReason; }

    public boolean isHasMeaningfulSignal() { return hasMeaningfulSignal; }
    public void setHasMeaningfulSignal(boolean hasMeaningfulSignal) { this.hasMeaningfulSignal = hasMeaningfulSignal; }

    public List<DraftVariation> getDrafts() { return drafts; }
    public void setDrafts(List<DraftVariation> drafts) { this.drafts = drafts; }

    public String getIntentMode() { return intentMode; }
    public void setIntentMode(String intentMode) { this.intentMode = intentMode; }

    @JsonProperty("isMock")
    public boolean isMock() { return isMock; }
    public void setMock(boolean mock) { isMock = mock; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public String getError() { return error; }
    public void setError(String error) { this.error = error; }
}
