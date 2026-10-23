package com.linkedin.ai.outreach.dto;

public class DraftVariation {
    private String id;
    private String title;
    private String tag;
    private String text;
    private int charCount;
    private int wordCount;
    private String type; // "connect_note", "direct_message", "reply"

    public DraftVariation() {}

    public DraftVariation(String id, String title, String tag, String text, String type) {
        this.id = id;
        this.title = title;
        this.tag = tag;
        this.text = text != null ? text.trim() : "";
        this.type = type;
        this.charCount = this.text.length();
        this.wordCount = this.text.isEmpty() ? 0 : this.text.split("\\s+").length;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getTag() { return tag; }
    public void setTag(String tag) { this.tag = tag; }

    public String getText() { return text; }
    public void setText(String text) {
        this.text = text != null ? text.trim() : "";
        this.charCount = this.text.length();
        this.wordCount = this.text.isEmpty() ? 0 : this.text.split("\\s+").length;
    }

    public int getCharCount() { return charCount; }
    public void setCharCount(int charCount) { this.charCount = charCount; }

    public int getWordCount() { return wordCount; }
    public void setWordCount(int wordCount) { this.wordCount = wordCount; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
}
