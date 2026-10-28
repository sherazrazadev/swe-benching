package export_test

import (
	"context"
	"testing"

	"github.com/apache/answer/internal/schema"
)

// Values a real user may legitimately supply, within the product's stated limits.
const (
	legitName  = "Alice & Bob"
	legitTitle = "How do I use A & B?"
	legitText  = "Use the config file."
	legitSite  = "Ask & Answer"

	// This title's address segment, built from the title as supplied.
	legitSlug = "how-do-i-use-a-and-b"

	questionURL = "https://example.test/questions/0/" + legitSlug
	answerURL   = questionURL + "/0"
	commentURL  = questionURL + "?commentId=7"
)

func TestFuncNewAnswerKeepsBodyAndSubject(t *testing.T) {
	title, body, err := newMailer(defaultSite()).NewAnswerTemplate(context.Background(), &schema.NewAnswerTemplateRawData{
		AnswerUserDisplayName: legitName,
		QuestionTitle:         legitTitle,
		QuestionID:            testQID,
		AnswerID:              testAID,
		AnswerSummary:         legitText,
		UnsubscribeCode:       "unsub-token",
	})
	if err != nil {
		t.Fatalf("render answer notification: %v", err)
	}
	assertBodyKeeps(t, "new answer", body, "<br>", "<blockquote>", "</blockquote>", "<a href='", answerURL)
	mustContain(t, "new answer subject", title, legitName)
	mustContain(t, "new answer visible text", decoded(body), legitName, legitTitle, legitText)
	if got := decoded(body); !contains(got, questionURL) {
		t.Fatalf("new answer: link address changed; want %q in body", questionURL)
	}
}

func TestFuncNewCommentKeepsBodyAndSubject(t *testing.T) {
	title, body, err := newMailer(defaultSite()).NewCommentTemplate(context.Background(), &schema.NewCommentTemplateRawData{
		CommentUserDisplayName: legitName,
		QuestionTitle:          legitTitle,
		QuestionID:             testQID,
		AnswerID:               "",
		CommentID:              testCID,
		CommentSummary:         legitText,
		UnsubscribeCode:        "unsub-token",
	})
	if err != nil {
		t.Fatalf("render comment notification: %v", err)
	}
	assertBodyKeeps(t, "new comment", body, "<br>", "<blockquote>", "</blockquote>", "<a href='", commentURL)
	mustContain(t, "new comment subject", title, legitName)
	mustContain(t, "new comment visible text", decoded(body), legitName, legitTitle, legitText)
}

func TestFuncInviteKeepsBodyAndSubject(t *testing.T) {
	title, body, err := newMailer(defaultSite()).NewInviteAnswerTemplate(context.Background(), &schema.NewInviteAnswerTemplateRawData{
		InviterDisplayName: legitName,
		QuestionTitle:      legitTitle,
		QuestionID:         testQID,
		UnsubscribeCode:    "unsub-token",
	})
	if err != nil {
		t.Fatalf("render invite notification: %v", err)
	}
	assertBodyKeeps(t, "invite", body, "<br>", "<blockquote>", "</blockquote>", "<a href='", questionURL)
	mustContain(t, "invite subject", title, legitName)
	mustContain(t, "invite visible text", decoded(body), legitName, legitTitle)
}

func TestFuncNewQuestionKeepsTagsAndLink(t *testing.T) {
	title, body, err := newMailer(defaultSite()).NewQuestionTemplate(context.Background(), &schema.NewQuestionTemplateRawData{
		QuestionAuthorUserID: "author-1",
		QuestionTitle:        legitTitle,
		QuestionID:           testQID,
		Tags:                 []string{"go", "c++", "yaml"},
		UnsubscribeCode:      "unsub-token",
	})
	if err != nil {
		t.Fatalf("render new question notification: %v", err)
	}
	assertBodyKeeps(t, "new question", body, "<br>", "<small>", "</small>", "<a href='", questionURL)
	mustContain(t, "new question subject", title, legitTitle)
	mustContain(t, "new question visible text", decoded(body), legitTitle, "go, c++, yaml")
}

func TestFuncRegisterKeepsStoredSiteName(t *testing.T) {
	title, body, err := newMailer(storedSite(legitSite)).RegisterTemplate(context.Background(), "https://example.test/activate?code=abc")
	if err != nil {
		t.Fatalf("render registration notification: %v", err)
	}
	assertBodyKeeps(t, "registration", body, "<br>", "<a href='", "https://example.test/activate?code=abc")
	mustContain(t, "registration subject", title, legitSite)
	mustContain(t, "registration visible text", decoded(body), legitSite)
}

func TestFuncPassResetKeepsStoredSiteName(t *testing.T) {
	title, body, err := newMailer(storedSite(legitSite)).PassResetTemplate(context.Background(), "https://example.test/reset?code=abc")
	if err != nil {
		t.Fatalf("render password reset notification: %v", err)
	}
	assertBodyKeeps(t, "password reset", body, "<br>", "<a href='", "https://example.test/reset?code=abc")
	mustContain(t, "password reset subject", title, legitSite)
	mustContain(t, "password reset visible text", decoded(body), legitSite)
}

func TestFuncChangeEmailKeepsStoredSiteName(t *testing.T) {
	title, body, err := newMailer(storedSite(legitSite)).ChangeEmailTemplate(context.Background(), "https://example.test/email?code=abc")
	if err != nil {
		t.Fatalf("render change email notification: %v", err)
	}
	assertBodyKeeps(t, "change email", body, "<br>", "<a href='", "https://example.test/email?code=abc")
	mustContain(t, "change email subject", title, legitSite)
	mustContain(t, "change email visible text", decoded(body), legitSite)
}

func TestFuncAcceptAnswerKeepsBodyAndSubject(t *testing.T) {
	title, body, err := newMailer(defaultSite()).NewAcceptAnswerTemplate(context.Background(), &schema.NewAcceptAnswerTemplateRawData{
		QuestionTitle:   legitTitle,
		QuestionID:      testQID,
		AnswerID:        testAID,
		DisplayName:     legitName,
		UnsubscribeCode: "unsub-token",
	})
	if err != nil {
		t.Fatalf("render accepted answer notification: %v", err)
	}
	assertBodyKeeps(t, "accepted answer", body, "<br>", "<a href='", answerURL)
	mustContain(t, "accepted answer subject", title, legitName)
	mustContain(t, "accepted answer visible text", decoded(body), legitName, legitTitle)
}

func TestFuncQuestionClosedKeepsBodyAndSubject(t *testing.T) {
	title, body, err := newMailer(defaultSite()).NewQuestionClosedTemplate(context.Background(), &schema.NewQuestionClosedTemplateRawData{
		QuestionTitle:   legitTitle,
		QuestionID:      testQID,
		DisplayName:     legitName,
		UnsubscribeCode: "unsub-token",
	})
	if err != nil {
		t.Fatalf("render question closed notification: %v", err)
	}
	assertBodyKeeps(t, "question closed", body, "<br>", "<a href='", questionURL)
	mustContain(t, "question closed subject", title, legitName)
	mustContain(t, "question closed visible text", decoded(body), legitName, legitTitle)
}
