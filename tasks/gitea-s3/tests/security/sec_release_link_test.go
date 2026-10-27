// Copyright 2026 The Gitea Authors. All rights reserved.
// SPDX-License-Identifier: MIT

package integration

import (
	"fmt"
	"testing"

	auth_model "gitea.dev/models/auth"
	"gitea.dev/modules/setting"
	"gitea.dev/modules/test"
	"gitea.dev/tests"

	"github.com/stretchr/testify/require"
)

// A file of a type the operator forbids for release assets must never become part of a
// release, whichever way it is attached.

func TestSec_EditReleaseFormRefusesForbiddenLinkedAttachment(t *testing.T) {
	defer tests.PrepareTestEnv(t)()
	defer test.MockVariableValue(&setting.Repository.Release.AllowedTypes, ".zip")()

	session := loginUser(t, "user2")
	uuid := secUploadIssueAttachment(t, session, "/user2/repo1", secSvgName, []byte(secMarker))
	secRequireNotLinked(t, uuid)

	req := NewRequestWithURLValues(t, "POST", "/user2/repo1/releases/edit/v1.1",
		secEditReleaseValues("testing-release", []string{uuid}))
	resp := session.MakeRequest(t, req, NoExpectedStatus)
	secRequireClientError(t, resp, secMarker)
	secRequireNotLinked(t, uuid)
}

func TestSec_NewReleaseFormRefusesForbiddenLinkedAttachment(t *testing.T) {
	defer tests.PrepareTestEnv(t)()
	defer test.MockVariableValue(&setting.Repository.Release.AllowedTypes, ".zip")()

	session := loginUser(t, "user2")
	uuid := secUploadIssueAttachment(t, session, "/user2/repo1", secSvgName, []byte(secMarker))
	secRequireNotLinked(t, uuid)

	req := NewRequestWithURLValues(t, "POST", "/user2/repo1/releases/new",
		secNewReleaseValues("sec-create-forbidden", "sec create forbidden", []string{uuid}))
	resp := session.MakeRequest(t, req, NoExpectedStatus)
	secRequireClientError(t, resp, secMarker)
	secRequireNotLinked(t, uuid)
}

func TestSec_TagConversionRefusesForbiddenLinkedAttachment(t *testing.T) {
	defer tests.PrepareTestEnv(t)()
	defer test.MockVariableValue(&setting.Repository.Release.AllowedTypes, ".zip")()

	session := loginUser(t, "user2")

	tagValues := secNewReleaseValues("sec-converted-tag", "", nil)
	tagValues.Set("tag_only", "1")
	req := NewRequestWithURLValues(t, "POST", "/user2/repo1/releases/new", tagValues)
	session.MakeRequest(t, req, NoExpectedStatus)

	uuid := secUploadIssueAttachment(t, session, "/user2/repo1", secSvgName, []byte(secMarker))
	req = NewRequestWithURLValues(t, "POST", "/user2/repo1/releases/new",
		secNewReleaseValues("sec-converted-tag", "sec converted tag", []string{uuid}))
	resp := session.MakeRequest(t, req, NoExpectedStatus)
	secRequireClientError(t, resp, secMarker)
	secRequireNotLinked(t, uuid)
}

func TestSec_EditReleaseFormRefusesMixedAttachmentList(t *testing.T) {
	defer tests.PrepareTestEnv(t)()
	defer test.MockVariableValue(&setting.Repository.Release.AllowedTypes, ".zip")()

	session := loginUser(t, "user2")
	allowed := secUploadIssueAttachment(t, session, "/user2/repo1", secZipName, []byte(secMarker))
	forbidden := secUploadIssueAttachment(t, session, "/user2/repo1", secSvgName, []byte(secMarker))

	req := NewRequestWithURLValues(t, "POST", "/user2/repo1/releases/edit/v1.1",
		secEditReleaseValues("testing-release", []string{allowed, forbidden}))
	resp := session.MakeRequest(t, req, NoExpectedStatus)
	secRequireClientError(t, resp, secMarker)
	secRequireNotLinked(t, allowed)
	secRequireNotLinked(t, forbidden)
}

func TestSec_ApiLinkRefusesForbiddenAttachment(t *testing.T) {
	defer tests.PrepareTestEnv(t)()
	defer test.MockVariableValue(&setting.Repository.Release.AllowedTypes, ".zip")()

	session := loginUser(t, "user2")
	uuid := secUploadIssueAttachment(t, session, "/user2/repo1", secSvgName, []byte(secMarker))
	att := secAttachment(t, uuid)
	secRequireNotLinked(t, uuid)

	token := getUserToken(t, "user2", auth_model.AccessTokenScopeWriteRepository)
	req := NewRequestWithJSON(t, "POST", "/api/v1/repos/user2/repo1/releases/1/assets/link",
		map[string]any{"attachment_ids": []int64{att.ID}}).AddTokenAuth(token)
	resp := MakeRequest(t, req, NoExpectedStatus)
	secRequireClientError(t, resp, secMarker)
	secRequireNotLinked(t, uuid)
}

func TestSec_ApiReplaceRefusesForbiddenAttachment(t *testing.T) {
	defer tests.PrepareTestEnv(t)()
	defer test.MockVariableValue(&setting.Repository.Release.AllowedTypes, ".zip")()

	keep := secStoreAttachment(t, 1, 1, 2, "c0ffee00-0000-4000-8000-000000000001", secZipName2, secMarker)

	session := loginUser(t, "user2")
	uuid := secUploadIssueAttachment(t, session, "/user2/repo1", secSvgName, []byte(secMarker))
	forbidden := secAttachment(t, uuid)

	token := getUserToken(t, "user2", auth_model.AccessTokenScopeWriteRepository)
	urlStr := fmt.Sprintf("/api/v1/repos/user2/repo1/releases/%d", keep.ReleaseID)
	req := NewRequestWithJSON(t, "PATCH", urlStr,
		map[string]any{"attachment_ids": []int64{forbidden.ID}}).AddTokenAuth(token)
	resp := MakeRequest(t, req, NoExpectedStatus)
	secRequireClientError(t, resp, secMarker)
	secRequireNotLinked(t, uuid)
	secRequireLinked(t, keep.UUID, keep.ReleaseID, secZipName2)
}

func TestSec_RefusedLinkLeavesStoredNameUnchanged(t *testing.T) {
	defer tests.PrepareTestEnv(t)()
	defer test.MockVariableValue(&setting.Repository.Release.AllowedTypes, ".zip")()

	session := loginUser(t, "user2")
	uuid := secUploadIssueAttachment(t, session, "/user2/repo1", secSvgName, []byte(secMarker))

	values := secEditReleaseValues("testing-release", []string{uuid})
	values.Set("attachment-edit-"+uuid, "renamed.zip")
	req := NewRequestWithURLValues(t, "POST", "/user2/repo1/releases/edit/v1.1", values)
	resp := session.MakeRequest(t, req, NoExpectedStatus)
	secRequireClientError(t, resp, secMarker)

	att := secAttachment(t, uuid)
	require.Equal(t, secSvgName, att.Name, "a refused request must not rename the attachment")
	require.Zero(t, att.ReleaseID, "a refused request must not link the attachment")
}
