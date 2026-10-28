package export_test

import (
	"context"
	"testing"

	"github.com/apache/answer/internal/schema"
)

const (
	evilImgName  = `<img src=x onerror=alert(1)>`
	evilSvgName  = `<svg onload=alert(2)>`
	evilScript   = `<script>alert(3)</script>`
	evilIframe   = `<iframe src=x>`
	evilImg2     = `<img src=y onerror=alert(4)>`
	evilStored   = `&lt;img src=x onerror=alert(9)&gt;`
	evilStoredIn = `<img src=x onerror=alert(9)>`
)

func renderAnswer(t *testing.T, name, title, summary string) string {
	t.Helper()
	_, body, err := newMailer(defaultSite()).NewAnswerTemplate(context.Background(), &schema.NewAnswerTemplateRawData{
		AnswerUserDisplayName: name,
		QuestionTitle:         title,
		QuestionID:            testQID,
		AnswerID:              testAID,
		AnswerSummary:         summary,
		UnsubscribeCode:       "unsub-token",
	})
	if err != nil {
		t.Fatalf("render answer notification: %v", err)
	}
	return body
}

func renderComment(t *testing.T, name, title, summary string) string {
	t.Helper()
	_, body, err := newMailer(defaultSite()).NewCommentTemplate(context.Background(), &schema.NewCommentTemplateRawData{
		CommentUserDisplayName: name,
		QuestionTitle:          title,
		QuestionID:             testQID,
		AnswerID:               "",
		CommentID:              testCID,
		CommentSummary:         summary,
		UnsubscribeCode:        "unsub-token",
	})
	if err != nil {
		t.Fatalf("render comment notification: %v", err)
	}
	return body
}

func renderInvite(t *testing.T, name, title string) string {
	t.Helper()
	_, body, err := newMailer(defaultSite()).NewInviteAnswerTemplate(context.Background(), &schema.NewInviteAnswerTemplateRawData{
		InviterDisplayName: name,
		QuestionTitle:      title,
		QuestionID:         testQID,
		UnsubscribeCode:    "unsub-token",
	})
	if err != nil {
		t.Fatalf("render invite notification: %v", err)
	}
	return body
}

func renderNewQuestion(t *testing.T, title string, tags []string) string {
	t.Helper()
	_, body, err := newMailer(defaultSite()).NewQuestionTemplate(context.Background(), &schema.NewQuestionTemplateRawData{
		QuestionAuthorUserID: "author-1",
		QuestionTitle:        title,
		QuestionID:           testQID,
		Tags:                 tags,
		UnsubscribeCode:      "unsub-token",
	})
	if err != nil {
		t.Fatalf("render new question notification: %v", err)
	}
	return body
}

// --- reported notification -------------------------------------------------

func TestSecNewAnswerDisplayName(t *testing.T) {
	body := renderAnswer(t, evilImgName, "A normal question title", "A normal answer summary.")
	assertNoLiveMarkup(t, "new answer display name", body, evilImgName)
}

func TestSecNewAnswerQuestionTitle(t *testing.T) {
	body := renderAnswer(t, "Alice", evilScript, "A normal answer summary.")
	assertNoLiveMarkup(t, "new answer question title", body, evilScript)
}

func TestSecNewAnswerSummary(t *testing.T) {
	body := renderAnswer(t, "Alice", "A normal question title", evilSvgName)
	assertNoLiveMarkup(t, "new answer summary", body, evilSvgName)
}

// --- neighbouring notification entry points --------------------------------

func TestSecNewCommentDisplayName(t *testing.T) {
	body := renderComment(t, evilImgName, "A normal question title", "A normal comment summary.")
	assertNoLiveMarkup(t, "new comment display name", body, evilImgName)
}

func TestSecNewCommentQuestionTitle(t *testing.T) {
	body := renderComment(t, "Alice", evilScript, "A normal comment summary.")
	assertNoLiveMarkup(t, "new comment question title", body, evilScript)
}

func TestSecNewCommentSummary(t *testing.T) {
	body := renderComment(t, "Alice", "A normal question title", evilImg2)
	assertNoLiveMarkup(t, "new comment summary", body, evilImg2)
}

func TestSecInviteDisplayName(t *testing.T) {
	body := renderInvite(t, evilSvgName, "A normal question title")
	assertNoLiveMarkup(t, "invite display name", body, evilSvgName)
}

func TestSecInviteQuestionTitle(t *testing.T) {
	body := renderInvite(t, "Alice", evilScript)
	assertNoLiveMarkup(t, "invite question title", body, evilScript)
}

func TestSecNewQuestionTitle(t *testing.T) {
	body := renderNewQuestion(t, evilScript, []string{"go"})
	assertNoLiveMarkup(t, "new question title", body, evilScript)
}

func TestSecNewQuestionTags(t *testing.T) {
	body := renderNewQuestion(t, "A normal question title", []string{"go", evilIframe, "yaml"})
	assertNoLiveMarkup(t, "new question tags", body, evilIframe)
}

// --- values stored in the product and read back later ----------------------

func TestSecRegisterStoredSiteName(t *testing.T) {
	_, body, err := newMailer(storedSite(evilStored)).RegisterTemplate(context.Background(), "https://example.test/activate?code=abc")
	if err != nil {
		t.Fatalf("render registration notification: %v", err)
	}
	assertNoLiveMarkup(t, "registration stored site name", body, evilStoredIn)
}

func TestSecPassResetStoredSiteName(t *testing.T) {
	_, body, err := newMailer(storedSite(evilStored)).PassResetTemplate(context.Background(), "https://example.test/reset?code=abc")
	if err != nil {
		t.Fatalf("render password reset notification: %v", err)
	}
	assertNoLiveMarkup(t, "password reset stored site name", body, evilStoredIn)
}

func TestSecChangeEmailStoredSiteName(t *testing.T) {
	_, body, err := newMailer(storedSite(evilStored)).ChangeEmailTemplate(context.Background(), "https://example.test/email?code=abc")
	if err != nil {
		t.Fatalf("render change email notification: %v", err)
	}
	assertNoLiveMarkup(t, "change email stored site name", body, evilStoredIn)
}

// --- status-change notifications -------------------------------------------

func TestSecAcceptAnswerDisplayName(t *testing.T) {
	_, body, err := newMailer(defaultSite()).NewAcceptAnswerTemplate(context.Background(), &schema.NewAcceptAnswerTemplateRawData{
		QuestionTitle:   "A normal question title",
		QuestionID:      testQID,
		AnswerID:        testAID,
		DisplayName:     evilSvgName,
		UnsubscribeCode: "unsub-token",
	})
	if err != nil {
		t.Fatalf("render accepted answer notification: %v", err)
	}
	assertNoLiveMarkup(t, "accepted answer display name", body, evilSvgName)
}

func TestSecAcceptAnswerQuestionTitle(t *testing.T) {
	_, body, err := newMailer(defaultSite()).NewAcceptAnswerTemplate(context.Background(), &schema.NewAcceptAnswerTemplateRawData{
		QuestionTitle:   evilScript,
		QuestionID:      testQID,
		AnswerID:        testAID,
		DisplayName:     "Alice",
		UnsubscribeCode: "unsub-token",
	})
	if err != nil {
		t.Fatalf("render accepted answer notification: %v", err)
	}
	assertNoLiveMarkup(t, "accepted answer question title", body, evilScript)
}

func TestSecQuestionClosedDisplayName(t *testing.T) {
	_, body, err := newMailer(defaultSite()).NewQuestionClosedTemplate(context.Background(), &schema.NewQuestionClosedTemplateRawData{
		QuestionTitle:   "A normal question title",
		QuestionID:      testQID,
		DisplayName:     evilImgName,
		UnsubscribeCode: "unsub-token",
	})
	if err != nil {
		t.Fatalf("render question closed notification: %v", err)
	}
	assertNoLiveMarkup(t, "question closed display name", body, evilImgName)
}

func TestSecQuestionClosedQuestionTitle(t *testing.T) {
	_, body, err := newMailer(defaultSite()).NewQuestionClosedTemplate(context.Background(), &schema.NewQuestionClosedTemplateRawData{
		QuestionTitle:   evilScript,
		QuestionID:      testQID,
		DisplayName:     "Alice",
		UnsubscribeCode: "unsub-token",
	})
	if err != nil {
		t.Fatalf("render question closed notification: %v", err)
	}
	assertNoLiveMarkup(t, "question closed question title", body, evilScript)
}
