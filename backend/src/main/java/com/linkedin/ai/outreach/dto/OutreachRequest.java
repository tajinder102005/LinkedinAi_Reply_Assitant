package com.linkedin.ai.outreach.dto;

public class OutreachRequest {
    private String recipientName;
    private String recipientHeadline;
    private String recipientAbout;
    private String currentCompany;
    private String currentRole;
    private String recentActivity;
    private String threadContext;
    private String intentMode; // referral, coffee_chat, founder_b2b, follow_up, contextual_reply
    private String tone; // Professional, Casual, Friendly, Concise, Sarcastic
    private String messageLength; // auto, 50w, 100w, 200w, 300w, 500w
    private String userNotes;
    private Integer charLimit; // e.g. 300 for connection notes
    private Boolean mock;

    public OutreachRequest() {}

    public String getRecipientName() { return recipientName; }
    public void setRecipientName(String recipientName) { this.recipientName = recipientName; }

    public String getRecipientHeadline() { return recipientHeadline; }
    public void setRecipientHeadline(String recipientHeadline) { this.recipientHeadline = recipientHeadline; }

    public String getRecipientAbout() { return recipientAbout; }
    public void setRecipientAbout(String recipientAbout) { this.recipientAbout = recipientAbout; }

    public String getCurrentCompany() { return currentCompany; }
    public void setCurrentCompany(String currentCompany) { this.currentCompany = currentCompany; }

    public String getCurrentRole() { return currentRole; }
    public void setCurrentRole(String currentRole) { this.currentRole = currentRole; }

    public String getRecentActivity() { return recentActivity; }
    public void setRecentActivity(String recentActivity) { this.recentActivity = recentActivity; }

    public String getThreadContext() { return threadContext; }
    public void setThreadContext(String threadContext) { this.threadContext = threadContext; }

    public String getIntentMode() { return intentMode; }
    public void setIntentMode(String intentMode) { this.intentMode = intentMode; }

    public String getTone() { return tone; }
    public void setTone(String tone) { this.tone = tone; }

    public String getMessageLength() { return messageLength; }
    public void setMessageLength(String messageLength) { this.messageLength = messageLength; }

    public String getUserNotes() { return userNotes; }
    public void setUserNotes(String userNotes) { this.userNotes = userNotes; }

    public Integer getCharLimit() { return charLimit; }
    public void setCharLimit(Integer charLimit) { this.charLimit = charLimit; }

    public Boolean getMock() { return mock; }
    public void setMock(Boolean mock) { this.mock = mock; }
}
