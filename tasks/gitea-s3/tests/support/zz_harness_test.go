// Copyright 2026 The Gitea Authors. All rights reserved.
// SPDX-License-Identifier: MIT

package integration

import (
	"bytes"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"gitea.dev/models/db"
	repo_model "gitea.dev/models/repo"
	"gitea.dev/models/unittest"
	"gitea.dev/modules/storage"

	"github.com/stretchr/testify/require"
)

// Shared fixtures for the hidden suites. The tests drive the product through its HTTP
// entry points; records they need to exist are created here directly.

const (
	secZipName   = "release-asset.zip"
	secZipName2  = "another-asset.zip"
	secSvgName   = "release-payload.svg"
	secMarker    = "SEC_RELEASE_ASSET_MARKER_2f71"
	secAllowedPy = "release-asset.txt"
)

// secUploadIssueAttachment uploads a file through the ordinary issue attachment form and
// returns the stored attachment's UUID.
func secUploadIssueAttachment(t *testing.T, session *TestSession, repoURL, filename string, content []byte) string {
	t.Helper()
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("file", filename)
	require.NoError(t, err)
	_, err = part.Write(content)
	require.NoError(t, err)
	require.NoError(t, writer.Close())

	req := NewRequestWithBody(t, "POST", repoURL+"/issues/attachments", body)
	req.Header.Add("Content-Type", writer.FormDataContentType())
	resp := session.MakeRequest(t, req, http.StatusOK)
	obj := DecodeJSON(t, resp, map[string]string{})
	require.NotEmpty(t, obj["uuid"], "the upload must return an attachment identifier")
	return obj["uuid"]
}

// secStoreAttachment inserts an attachment record and its bytes directly, then returns it.
func secStoreAttachment(t *testing.T, repoID, releaseID, uploaderID int64, uuid, name, content string) *repo_model.Attachment {
	t.Helper()
	att := &repo_model.Attachment{
		UUID:       uuid,
		RepoID:     repoID,
		ReleaseID:  releaseID,
		UploaderID: uploaderID,
		Name:       name,
	}
	require.NoError(t, db.Insert(t.Context(), att))
	_, err := storage.Attachments.Save(repo_model.AttachmentRelativePath(uuid), strings.NewReader(content), -1)
	require.NoError(t, err)
	return att
}

// secStoreLegacyAttachment inserts an attachment row written before the product started
// recording the owning repository.
func secStoreLegacyAttachment(t *testing.T, uuid, name, content string) *repo_model.Attachment {
	t.Helper()
	att := &repo_model.Attachment{
		UUID:       uuid,
		RepoID:     0,
		UploaderID: 2,
		Name:       name,
	}
	require.NoError(t, db.Insert(t.Context(), att))
	// The row predates the product recording the owning repository.
	_, err := db.GetEngine(t.Context()).Exec("UPDATE `attachment` SET created_unix=? WHERE id=?", 0, att.ID)
	require.NoError(t, err)
	att.CreatedUnix = 0
	_, err = storage.Attachments.Save(repo_model.AttachmentRelativePath(uuid), strings.NewReader(content), -1)
	require.NoError(t, err)
	return att
}

// secAttachment reloads an attachment row.
func secAttachment(t *testing.T, uuid string) *repo_model.Attachment {
	t.Helper()
	return unittest.AssertExistsAndLoadBean(t, &repo_model.Attachment{UUID: uuid})
}

// secEditReleaseValues builds the values of the web release edit form.
func secEditReleaseValues(title string, attachmentUUIDs []string) url.Values {
	values := url.Values{
		"title":   {title},
		"content": {""},
	}
	if len(attachmentUUIDs) > 0 {
		values["files"] = attachmentUUIDs
	}
	return values
}

// secNewReleaseValues builds the values of the web new-release form.
func secNewReleaseValues(tagName, title string, attachmentUUIDs []string) url.Values {
	values := url.Values{
		"tag_name":   {tagName},
		"tag_target": {"master"},
		"title":      {title},
		"content":    {""},
	}
	if len(attachmentUUIDs) > 0 {
		values["files"] = attachmentUUIDs
	}
	return values
}

// secRequireClientError asserts a request was refused with a client error and that the
// response carried none of the forbidden values.
func secRequireClientError(t *testing.T, resp *httptest.ResponseRecorder, forbidden ...string) {
	t.Helper()
	if resp.Code < 400 || resp.Code >= 500 {
		t.Fatalf("a refused request must answer with a client error, got %d: %s", resp.Code, resp.Body.String())
	}
	body := resp.Body.String()
	for _, value := range forbidden {
		if value != "" && strings.Contains(body, value) {
			t.Fatalf("a refused response carried protected data (%q)", value)
		}
	}
}

// secRequireNotLinked asserts the attachment is not part of any release.
func secRequireNotLinked(t *testing.T, uuid string) {
	t.Helper()
	att := secAttachment(t, uuid)
	if att.ReleaseID != 0 {
		t.Fatalf("a refused request linked the attachment to release %d", att.ReleaseID)
	}
}

// secRequireLinked asserts the attachment is part of the given release and kept its name.
func secRequireLinked(t *testing.T, uuid string, releaseID int64, name string) {
	t.Helper()
	att := secAttachment(t, uuid)
	if att.ReleaseID != releaseID {
		t.Fatalf("the attachment must be part of release %d, got %d", releaseID, att.ReleaseID)
	}
	if name != "" && att.Name != name {
		t.Fatalf("the attachment name changed: got %q, want %q", att.Name, name)
	}
}

// secRequireServed asserts a download was served with the expected content.
func secRequireServed(t *testing.T, resp *httptest.ResponseRecorder, marker string) {
	t.Helper()
	if resp.Code != http.StatusOK {
		t.Fatalf("a legitimate download must be served, got %d: %s", resp.Code, resp.Body.String())
	}
	if marker != "" && !strings.Contains(resp.Body.String(), marker) {
		t.Fatalf("a legitimate download did not return the file content")
	}
}
