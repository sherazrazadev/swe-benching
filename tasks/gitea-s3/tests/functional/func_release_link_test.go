// Copyright 2026 The Gitea Authors. All rights reserved.
// SPDX-License-Identifier: MIT

package integration

import (
	"fmt"
	"net/http"
	"net/url"
	"testing"

	auth_model "gitea.dev/models/auth"
	repo_model "gitea.dev/models/repo"
	"gitea.dev/models/unittest"
	"gitea.dev/modules/setting"
	"gitea.dev/modules/test"
	"gitea.dev/tests"

	"github.com/stretchr/testify/require"
)

// Legitimate attachment behaviour that must keep working next to the release asset type policy.

func TestFunc_UnrestrictedReleaseTypesAllowAnyAttachment(t *testing.T) {
	defer tests.PrepareTestEnv(t)()
	defer test.MockVariableValue(&setting.Repository.Release.AllowedTypes, "")()

	session := loginUser(t, "user2")
	uuid := secUploadIssueAttachment(t, session, "/user2/repo1", secSvgName, []byte(secMarker))

	req := NewRequestWithURLValues(t, "POST", "/user2/repo1/releases/edit/v1.1",
		secEditReleaseValues("testing-release", []string{uuid}))
	resp := session.MakeRequest(t, req, NoExpectedStatus)
	require.Less(t, resp.Code, http.StatusBadRequest, "with no configured restriction the attachment must link")
	secRequireLinked(t, uuid, 1, secSvgName)
}

func TestFunc_AllowedAttachmentLinksViaEditForm(t *testing.T) {
	defer tests.PrepareTestEnv(t)()
	defer test.MockVariableValue(&setting.Repository.Release.AllowedTypes, ".zip")()

	session := loginUser(t, "user2")
	uuid := secUploadIssueAttachment(t, session, "/user2/repo1", secZipName, []byte(secMarker))

	req := NewRequestWithURLValues(t, "POST", "/user2/repo1/releases/edit/v1.1",
		secEditReleaseValues("testing-release", []string{uuid}))
	resp := session.MakeRequest(t, req, NoExpectedStatus)
	require.Less(t, resp.Code, http.StatusBadRequest, "an allowed attachment must link")
	secRequireLinked(t, uuid, 1, secZipName)

	req = NewRequest(t, "GET", "/user2/repo1/releases/download/v1.1/"+secZipName)
	resp = session.MakeRequest(t, req, NoExpectedStatus)
	secRequireServed(t, resp, secMarker)
}

func TestFunc_AllowedAttachmentLinksViaNewReleaseForm(t *testing.T) {
	defer tests.PrepareTestEnv(t)()
	defer test.MockVariableValue(&setting.Repository.Release.AllowedTypes, ".zip")()

	session := loginUser(t, "user2")
	uuid := secUploadIssueAttachment(t, session, "/user2/repo1", secZipName, []byte(secMarker))

	req := NewRequestWithURLValues(t, "POST", "/user2/repo1/releases/new",
		secNewReleaseValues("func-created-asset", "func created asset", []string{uuid}))
	resp := session.MakeRequest(t, req, NoExpectedStatus)
	require.Less(t, resp.Code, http.StatusBadRequest, "an allowed attachment must link while creating a release")

	release, err := repo_model.GetRelease(t.Context(), 1, "func-created-asset")
	require.NoError(t, err)
	secRequireLinked(t, uuid, release.ID, secZipName)
}

func TestFunc_LegacyAttachmentStillAdopted(t *testing.T) {
	defer tests.PrepareTestEnv(t)()
	defer test.MockVariableValue(&setting.Repository.Release.AllowedTypes, ".zip")()

	legacy := secStoreLegacyAttachment(t, "c0ffee00-0000-4000-8000-000000000002", "legacy-asset.zip", secMarker)

	session := loginUser(t, "user2")
	req := NewRequestWithURLValues(t, "POST", "/user2/repo1/releases/edit/v1.1",
		secEditReleaseValues("testing-release", []string{legacy.UUID}))
	resp := session.MakeRequest(t, req, NoExpectedStatus)
	require.Less(t, resp.Code, http.StatusBadRequest, "an older stored attachment must still link")

	att := secAttachment(t, legacy.UUID)
	require.EqualValues(t, 1, att.RepoID, "the older attachment must be adopted into the release's repository")
	require.EqualValues(t, 1, att.ReleaseID, "the older attachment must be part of the release")
}

func TestFunc_ReleaseAttachmentRenameStillValidated(t *testing.T) {
	defer tests.PrepareTestEnv(t)()
	defer test.MockVariableValue(&setting.Repository.Release.AllowedTypes, ".zip")()

	att := unittest.AssertExistsAndLoadBean(t, &repo_model.Attachment{ID: 9})
	session := loginUser(t, "user2")

	values := url.Values{
		"title":   {"testing-release"},
		"content": {""},
	}
	values.Set("attachment-edit-"+att.UUID, "renamed.exe")
	req := NewRequestWithURLValues(t, "POST", "/user2/repo1/releases/edit/v1.1", values)
	resp := session.MakeRequest(t, req, NoExpectedStatus)
	secRequireClientError(t, resp)
	require.Equal(t, att.Name, secAttachment(t, att.UUID).Name, "a refused rename must not change the name")

	values.Set("attachment-edit-"+att.UUID, "renamed.zip")
	req = NewRequestWithURLValues(t, "POST", "/user2/repo1/releases/edit/v1.1", values)
	resp = session.MakeRequest(t, req, NoExpectedStatus)
	require.Less(t, resp.Code, http.StatusBadRequest, "an allowed rename must succeed")
	require.Equal(t, "renamed.zip", secAttachment(t, att.UUID).Name)
}

func TestFunc_ApiLinkAllowsAllowedAttachment(t *testing.T) {
	defer tests.PrepareTestEnv(t)()
	defer test.MockVariableValue(&setting.Repository.Release.AllowedTypes, ".zip")()

	session := loginUser(t, "user2")
	uuid := secUploadIssueAttachment(t, session, "/user2/repo1", secZipName, []byte(secMarker))
	att := secAttachment(t, uuid)

	token := getUserToken(t, "user2", auth_model.AccessTokenScopeWriteRepository)
	req := NewRequestWithJSON(t, "POST", "/api/v1/repos/user2/repo1/releases/1/assets/link",
		map[string]any{"attachment_ids": []int64{att.ID}}).AddTokenAuth(token)
	resp := MakeRequest(t, req, NoExpectedStatus)
	require.Equal(t, http.StatusCreated, resp.Code, "an allowed attachment must link: %s", resp.Body.String())
	secRequireLinked(t, uuid, 1, secZipName)
}

func TestFunc_ApiReplaceLinksAllowedAttachment(t *testing.T) {
	defer tests.PrepareTestEnv(t)()
	defer test.MockVariableValue(&setting.Repository.Release.AllowedTypes, ".zip")()

	keep := secStoreAttachment(t, 1, 0, 2, "c0ffee00-0000-4000-8000-000000000003", secZipName2, secMarker)

	token := getUserToken(t, "user2", auth_model.AccessTokenScopeWriteRepository)
	urlStr := fmt.Sprintf("/api/v1/repos/user2/repo1/releases/%d", 1)
	req := NewRequestWithJSON(t, "PATCH", urlStr,
		map[string]any{"attachment_ids": []int64{keep.ID}}).AddTokenAuth(token)
	resp := MakeRequest(t, req, NoExpectedStatus)
	require.Equal(t, http.StatusOK, resp.Code, "an allowed attachment must link: %s", resp.Body.String())
	secRequireLinked(t, keep.UUID, 1, secZipName2)
}
