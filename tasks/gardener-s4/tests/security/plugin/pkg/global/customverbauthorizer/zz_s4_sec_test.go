// SPDX-FileCopyrightText: SAP SE or an SAP affiliate company and Gardener contributors
//
// SPDX-License-Identifier: Apache-2.0

package customverbauthorizer_test

import (
	"context"
	"testing"

	"go.uber.org/mock/gomock"
	rbacv1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/authentication/user"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/gardener/gardener/pkg/apis/core"
	gardencoreinformers "github.com/gardener/gardener/pkg/client/core/informers/externalversions"
	. "github.com/gardener/gardener/plugin/pkg/global/customverbauthorizer"
	mockauthorizer "github.com/gardener/gardener/third_party/mock/apiserver/authorization/authorizer"
)

func s4Authorizer(t *testing.T, decision authorizer.Decision) *CustomVerbAuthorizer {
	t.Helper()

	ctrl := gomock.NewController(t)
	auth := mockauthorizer.NewMockAuthorizer(ctrl)
	auth.EXPECT().Authorize(gomock.Any(), gomock.Any()).Return(decision, "", nil).AnyTimes()

	handler, err := New()
	if err != nil {
		t.Fatalf("creating admission plugin: %v", err)
	}
	handler.SetAuthorizer(auth)
	handler.AssignReadyFunc(func() bool { return true })
	handler.SetCoreInformerFactory(gardencoreinformers.NewSharedInformerFactory(nil, 0))

	return handler
}

func s4Project(members []core.ProjectMember, owner *rbacv1.Subject) *core.Project {
	project := &core.Project{ObjectMeta: metav1.ObjectMeta{Name: "dummy"}}
	project.Spec.Owner = owner
	project.Spec.Members = members
	return project
}

func s4UpdateAttrs(project, oldProject *core.Project, info user.Info) admission.Attributes {
	return admission.NewAttributesRecord(project, oldProject, core.Kind("Project").WithVersion("version"),
		project.Namespace, project.Name, core.Resource("projects").WithVersion("version"), "",
		admission.Update, &metav1.UpdateOptions{}, false, info)
}

func s4CreateAttrs(project *core.Project, info user.Info) admission.Attributes {
	return admission.NewAttributesRecord(project, nil, core.Kind("Project").WithVersion("version"),
		project.Namespace, project.Name, core.Resource("projects").WithVersion("version"), "",
		admission.Create, &metav1.CreateOptions{}, false, info)
}

func s4User(name string) user.Info {
	return &user.DefaultInfo{Name: name, Groups: []string{"system:authenticated"}}
}

func s4UserWithGroups(name string, groups ...string) user.Info {
	return &user.DefaultInfo{Name: name, Groups: groups}
}

func s4Human(name string) rbacv1.Subject {
	return rbacv1.Subject{APIGroup: rbacv1.GroupName, Kind: rbacv1.UserKind, Name: name}
}

func s4Group(name string) rbacv1.Subject {
	return rbacv1.Subject{APIGroup: rbacv1.GroupName, Kind: rbacv1.GroupKind, Name: name}
}

func s4ServiceAccount(namespace, name string) rbacv1.Subject {
	return rbacv1.Subject{Kind: rbacv1.ServiceAccountKind, Namespace: namespace, Name: name}
}

func s4ServiceAccountUser(namespace, name string) rbacv1.Subject {
	return rbacv1.Subject{APIGroup: rbacv1.GroupName, Kind: rbacv1.UserKind, Name: "system:serviceaccount:" + namespace + ":" + name}
}

func s4Member(subject rbacv1.Subject, roles ...string) core.ProjectMember {
	return core.ProjectMember{Subject: subject, Roles: roles}
}

// TestSecZZGroupMemberAddedOnUpdate covers the reported impact: a project member without
// manage-members adds a group to the member list.
func TestSecZZGroupMemberAddedOnUpdate(t *testing.T) {
	owner := s4Human("owner")
	oldProject := s4Project([]core.ProjectMember{s4Member(owner, "admin", "owner")}, &owner)
	newProject := oldProject.DeepCopy()
	newProject.Spec.Members = append(newProject.Spec.Members, s4Member(s4Group("s4-attackers"), "admin"))

	handler := s4Authorizer(t, authorizer.DecisionDeny)
	if err := handler.Validate(context.Background(), s4UpdateAttrs(newProject, oldProject, s4User("mallory")), nil); err == nil {
		t.Fatal("a group was added to the project member list without the manage-members permission")
	}
}

func TestSecZZGroupMemberRemovedOnUpdate(t *testing.T) {
	owner := s4Human("owner")
	oldProject := s4Project([]core.ProjectMember{
		s4Member(owner, "admin", "owner"),
		s4Member(s4Group("s4-attackers"), "admin"),
	}, &owner)
	newProject := oldProject.DeepCopy()
	newProject.Spec.Members = []core.ProjectMember{s4Member(owner, "admin", "owner")}

	handler := s4Authorizer(t, authorizer.DecisionDeny)
	if err := handler.Validate(context.Background(), s4UpdateAttrs(newProject, oldProject, s4User("mallory")), nil); err == nil {
		t.Fatal("a group was removed from the project member list without the manage-members permission")
	}
}

func TestSecZZGroupMemberRolesChangedOnUpdate(t *testing.T) {
	owner := s4Human("owner")
	group := s4Group("s4-viewers")
	oldProject := s4Project([]core.ProjectMember{
		s4Member(owner, "admin", "owner"),
		s4Member(group, "viewer"),
	}, &owner)
	newProject := oldProject.DeepCopy()
	newProject.Spec.Members[1].Roles = []string{"admin"}

	handler := s4Authorizer(t, authorizer.DecisionDeny)
	if err := handler.Validate(context.Background(), s4UpdateAttrs(newProject, oldProject, s4User("mallory")), nil); err == nil {
		t.Fatal("a group member's roles were changed without the manage-members permission")
	}
}

func TestSecZZGroupMemberAddedOnCreate(t *testing.T) {
	owner := s4Human("owner")
	project := s4Project([]core.ProjectMember{
		s4Member(owner, "admin", "owner"),
		s4Member(s4Group("s4-attackers"), "admin"),
	}, &owner)

	handler := s4Authorizer(t, authorizer.DecisionDeny)
	if err := handler.Validate(context.Background(), s4CreateAttrs(project, s4User("mallory")), nil); err == nil {
		t.Fatal("a group was added to a new project by a requester who is not its owner and holds no manage-members permission")
	}
}

// TestSecZZOwnerlessProjectGroupAdded covers the project state in which no owner is recorded.
func TestSecZZOwnerlessProjectGroupAdded(t *testing.T) {
	oldProject := s4Project([]core.ProjectMember{s4Member(s4Human("alice"), "admin")}, nil)
	newProject := oldProject.DeepCopy()
	newProject.Spec.Members = append(newProject.Spec.Members, s4Member(s4Group("s4-attackers"), "admin"))

	handler := s4Authorizer(t, authorizer.DecisionDeny)
	if err := handler.Validate(context.Background(), s4UpdateAttrs(newProject, oldProject, s4User("mallory")), nil); err == nil {
		t.Fatal("a group was added to a project that records no owner without the manage-members permission")
	}
}

func TestSecZZOwnerlessProjectUserAdded(t *testing.T) {
	oldProject := s4Project([]core.ProjectMember{s4Member(s4Human("alice"), "admin")}, nil)
	newProject := oldProject.DeepCopy()
	newProject.Spec.Members = append(newProject.Spec.Members, s4Member(s4Human("mallory"), "admin"))

	handler := s4Authorizer(t, authorizer.DecisionDeny)
	if err := handler.Validate(context.Background(), s4UpdateAttrs(newProject, oldProject, s4User("mallory")), nil); err == nil {
		t.Fatal("a user was added to a project that records no owner without the manage-members permission")
	}
}

func TestSecZZOwnerlessProjectOwnerInstalled(t *testing.T) {
	oldProject := s4Project([]core.ProjectMember{s4Member(s4Human("alice"), "admin")}, nil)
	newProject := oldProject.DeepCopy()
	owner := s4Human("mallory")
	newProject.Spec.Owner = &owner

	handler := s4Authorizer(t, authorizer.DecisionDeny)
	if err := handler.Validate(context.Background(), s4UpdateAttrs(newProject, oldProject, s4User("mallory")), nil); err == nil {
		t.Fatal("an owner was installed on a project that records none without the manage-members permission")
	}
}

func TestSecZZOwnerlessProjectOwnerAndGroupInstalled(t *testing.T) {
	oldProject := s4Project([]core.ProjectMember{s4Member(s4Human("alice"), "admin")}, nil)
	newProject := oldProject.DeepCopy()
	owner := s4Human("mallory")
	newProject.Spec.Owner = &owner
	newProject.Spec.Members = append(newProject.Spec.Members, s4Member(s4Group("s4-attackers"), "admin"))

	handler := s4Authorizer(t, authorizer.DecisionDeny)
	if err := handler.Validate(context.Background(), s4UpdateAttrs(newProject, oldProject, s4User("mallory")), nil); err == nil {
		t.Fatal("an owner and a group were installed on a project that records no owner without the manage-members permission")
	}
}

// TestSecZZServiceAccountGroupSubject covers group subjects whose name has the shape of a service
// account identity. A group is never a service account.
func TestSecZZServiceAccountGroupSubject(t *testing.T) {
	owner := s4Human("owner")
	for _, groupName := range []string{
		"system:serviceaccounts",
		"system:serviceaccounts:garden-dummy",
		"system:serviceaccount:garden-dummy:builder",
	} {
		t.Run(groupName, func(t *testing.T) {
			oldProject := s4Project([]core.ProjectMember{s4Member(owner, "admin", "owner")}, &owner)
			newProject := oldProject.DeepCopy()
			newProject.Spec.Members = append(newProject.Spec.Members, s4Member(s4Group(groupName), "admin"))

			handler := s4Authorizer(t, authorizer.DecisionDeny)
			if err := handler.Validate(context.Background(), s4UpdateAttrs(newProject, oldProject, s4User("mallory")), nil); err == nil {
				t.Fatalf("group %q was added to the project member list without the manage-members permission", groupName)
			}
		})
	}
}

// TestSecZZServiceAccountRequester covers requests issued by a service account. The identity of the
// requester does not authorize a membership change.
func TestSecZZServiceAccountRequester(t *testing.T) {
	owner := s4Human("owner")
	oldProject := s4Project([]core.ProjectMember{s4Member(owner, "admin", "owner")}, &owner)
	newProject := oldProject.DeepCopy()
	newProject.Spec.Members = append(newProject.Spec.Members, s4Member(s4Group("s4-attackers"), "admin"))

	handler := s4Authorizer(t, authorizer.DecisionDeny)
	requester := s4UserWithGroups("system:serviceaccount:garden-dummy:ci",
		"system:serviceaccounts", "system:serviceaccounts:garden-dummy", "system:authenticated")
	if err := handler.Validate(context.Background(), s4UpdateAttrs(newProject, oldProject, requester), nil); err == nil {
		t.Fatal("a service account requester changed the project member list without the manage-members permission")
	}
}

// s4SelectiveAuthorizer allows everything except the manage-members verb on the project resource.
// An authorization decision for another resource must not authorize a project membership change.
type s4SelectiveAuthorizer struct{}

func (s4SelectiveAuthorizer) Authorize(_ context.Context, attrs authorizer.Attributes) (authorizer.Decision, string, error) {
	if attrs.GetResource() == "projects" && attrs.GetVerb() == "manage-members" {
		return authorizer.DecisionDeny, "", nil
	}
	return authorizer.DecisionAllow, "", nil
}

// TestSecZZManageMembersOnAnotherResourceDoesNotAuthorize checks that the decision is taken for the
// object the request changes.
func TestSecZZManageMembersOnAnotherResourceDoesNotAuthorize(t *testing.T) {
	owner := s4Human("owner")
	oldProject := s4Project([]core.ProjectMember{s4Member(owner, "admin", "owner")}, &owner)
	newProject := oldProject.DeepCopy()
	newProject.Spec.Members = append(newProject.Spec.Members, s4Member(s4Group("s4-attackers"), "admin"))

	handler, err := New()
	if err != nil {
		t.Fatalf("creating admission plugin: %v", err)
	}
	handler.SetAuthorizer(s4SelectiveAuthorizer{})
	handler.AssignReadyFunc(func() bool { return true })
	handler.SetCoreInformerFactory(gardencoreinformers.NewSharedInformerFactory(nil, 0))

	if err := handler.Validate(context.Background(), s4UpdateAttrs(newProject, oldProject, s4User("mallory")), nil); err == nil {
		t.Fatal("a group was added to the project member list on the strength of a permission for another resource")
	}
}
