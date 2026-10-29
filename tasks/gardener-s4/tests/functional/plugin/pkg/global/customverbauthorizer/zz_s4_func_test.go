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

func f4Authorizer(t *testing.T, decision authorizer.Decision) *CustomVerbAuthorizer {
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

func f4Project(members []core.ProjectMember, owner *rbacv1.Subject) *core.Project {
	project := &core.Project{ObjectMeta: metav1.ObjectMeta{Name: "dummy"}}
	project.Spec.Owner = owner
	project.Spec.Members = members
	return project
}

func f4UpdateAttrs(project, oldProject *core.Project, info user.Info) admission.Attributes {
	return admission.NewAttributesRecord(project, oldProject, core.Kind("Project").WithVersion("version"),
		project.Namespace, project.Name, core.Resource("projects").WithVersion("version"), "",
		admission.Update, &metav1.UpdateOptions{}, false, info)
}

func f4CreateAttrs(project *core.Project, info user.Info) admission.Attributes {
	return admission.NewAttributesRecord(project, nil, core.Kind("Project").WithVersion("version"),
		project.Namespace, project.Name, core.Resource("projects").WithVersion("version"), "",
		admission.Create, &metav1.CreateOptions{}, false, info)
}

func f4User(name string) user.Info {
	return &user.DefaultInfo{Name: name, Groups: []string{"system:authenticated"}}
}

func f4Human(name string) rbacv1.Subject {
	return rbacv1.Subject{APIGroup: rbacv1.GroupName, Kind: rbacv1.UserKind, Name: name}
}

func f4Group(name string) rbacv1.Subject {
	return rbacv1.Subject{APIGroup: rbacv1.GroupName, Kind: rbacv1.GroupKind, Name: name}
}

func f4ServiceAccount(namespace, name string) rbacv1.Subject {
	return rbacv1.Subject{Kind: rbacv1.ServiceAccountKind, Namespace: namespace, Name: name}
}

func f4ServiceAccountUser(namespace, name string) rbacv1.Subject {
	return rbacv1.Subject{APIGroup: rbacv1.GroupName, Kind: rbacv1.UserKind, Name: "system:serviceaccount:" + namespace + ":" + name}
}

func f4Member(subject rbacv1.Subject, roles ...string) core.ProjectMember {
	return core.ProjectMember{Subject: subject, Roles: roles}
}

func TestFuncZZServiceAccountMembersNeedNoPermission(t *testing.T) {
	owner := f4Human("owner")
	oldProject := f4Project([]core.ProjectMember{s4MemberForFunc(owner, "admin", "owner")}, &owner)
	newProject := oldProject.DeepCopy()
	newProject.Spec.Members = append(newProject.Spec.Members,
		s4MemberForFunc(f4ServiceAccount("garden-dummy", "builder"), "serviceaccountmanager"),
		s4MemberForFunc(f4ServiceAccount("garden-dummy", "reader"), "viewer"),
	)

	handler := f4Authorizer(t, authorizer.DecisionDeny)
	if err := handler.Validate(context.Background(), f4UpdateAttrs(newProject, oldProject, f4User("member")), nil); err != nil {
		t.Fatalf("adding service account members required the manage-members permission: %v", err)
	}
}

func TestFuncZZServiceAccountUserMembersNeedNoPermission(t *testing.T) {
	owner := f4Human("owner")
	oldProject := f4Project([]core.ProjectMember{s4MemberForFunc(owner, "admin", "owner")}, &owner)
	newProject := oldProject.DeepCopy()
	newProject.Spec.Members = append(newProject.Spec.Members,
		s4MemberForFunc(f4ServiceAccountUser("garden-dummy", "builder"), "admin"),
	)

	handler := f4Authorizer(t, authorizer.DecisionDeny)
	if err := handler.Validate(context.Background(), f4UpdateAttrs(newProject, oldProject, f4User("member")), nil); err != nil {
		t.Fatalf("adding a service-account user member required the manage-members permission: %v", err)
	}

	removed := oldProject.DeepCopy()
	if err := handler.Validate(context.Background(), f4UpdateAttrs(removed, newProject, f4User("member")), nil); err != nil {
		t.Fatalf("removing a service-account user member required the manage-members permission: %v", err)
	}
}

func TestFuncZZOwnerTransferNeedsNoPermission(t *testing.T) {
	owner := f4Human("owner")
	newOwner := f4Human("new-owner")
	oldProject := f4Project([]core.ProjectMember{s4MemberForFunc(owner, "admin", "owner")}, &owner)
	newProject := oldProject.DeepCopy()
	newProject.Spec.Owner = &newOwner
	newProject.Spec.Members = append(newProject.Spec.Members, s4MemberForFunc(newOwner, "admin", "owner"))

	handler := f4Authorizer(t, authorizer.DecisionDeny)
	if err := handler.Validate(context.Background(), f4UpdateAttrs(newProject, oldProject, f4User("owner")), nil); err != nil {
		t.Fatalf("the current owner could not transfer ownership: %v", err)
	}
}

func TestFuncZZCreateWithUnrecordedOwner(t *testing.T) {
	project := f4Project([]core.ProjectMember{
		s4MemberForFunc(f4Human("alice"), "admin"),
		s4MemberForFunc(f4Group("team"), "viewer"),
	}, nil)

	handler := f4Authorizer(t, authorizer.DecisionDeny)
	if err := handler.Validate(context.Background(), f4CreateAttrs(project, f4User("creator")), nil); err != nil {
		t.Fatalf("creating a project whose owner is not recorded yet was rejected: %v", err)
	}
}

func TestFuncZZCreatorOwnsNewProject(t *testing.T) {
	creator := f4Human("creator")
	project := f4Project([]core.ProjectMember{
		s4MemberForFunc(creator, "admin", "owner"),
		s4MemberForFunc(f4Group("team"), "admin"),
	}, &creator)

	handler := f4Authorizer(t, authorizer.DecisionDeny)
	if err := handler.Validate(context.Background(), f4CreateAttrs(project, f4User("creator")), nil); err != nil {
		t.Fatalf("a project creator could not list members on a new project: %v", err)
	}
}

func TestFuncZZAuthorizedGroupChangeApplies(t *testing.T) {
	owner := f4Human("owner")
	oldProject := f4Project([]core.ProjectMember{s4MemberForFunc(owner, "admin", "owner")}, &owner)
	newProject := oldProject.DeepCopy()
	newProject.Spec.Members = append(newProject.Spec.Members, s4MemberForFunc(f4Group("team"), "admin"))

	handler := f4Authorizer(t, authorizer.DecisionAllow)
	if err := handler.Validate(context.Background(), f4UpdateAttrs(newProject, oldProject, f4User("uam-member")), nil); err != nil {
		t.Fatalf("an authorized group member change was rejected: %v", err)
	}
}

func TestFuncZZOrdinaryUpdateNeedsNoPermission(t *testing.T) {
	owner := f4Human("owner")
	oldProject := f4Project([]core.ProjectMember{s4MemberForFunc(owner, "admin", "owner")}, &owner)
	newProject := oldProject.DeepCopy()
	description := "updated description"
	newProject.Spec.Description = &description

	handler := f4Authorizer(t, authorizer.DecisionDeny)
	if err := handler.Validate(context.Background(), f4UpdateAttrs(newProject, oldProject, f4User("member")), nil); err != nil {
		t.Fatalf("an ordinary project update was rejected: %v", err)
	}
}

func TestFuncZZServiceAccountRequesterWithPermission(t *testing.T) {
	owner := f4Human("owner")
	oldProject := f4Project([]core.ProjectMember{s4MemberForFunc(owner, "admin", "owner")}, &owner)
	newProject := oldProject.DeepCopy()
	newProject.Spec.Members = append(newProject.Spec.Members, s4MemberForFunc(f4Group("team"), "admin"))

	handler := f4Authorizer(t, authorizer.DecisionAllow)
	requester := &user.DefaultInfo{Name: "system:serviceaccount:garden-dummy:ci", Groups: []string{"system:serviceaccounts", "system:authenticated"}}
	if err := handler.Validate(context.Background(), f4UpdateAttrs(newProject, oldProject, requester), nil); err != nil {
		t.Fatalf("an authorized service account requester was rejected: %v", err)
	}
}

func TestFuncZZAuthorizedOwnerlessProjectChange(t *testing.T) {
	oldProject := f4Project([]core.ProjectMember{s4MemberForFunc(f4Human("alice"), "admin")}, nil)
	newProject := oldProject.DeepCopy()
	newProject.Spec.Members = append(newProject.Spec.Members, s4MemberForFunc(f4Group("team"), "admin"))

	handler := f4Authorizer(t, authorizer.DecisionAllow)
	if err := handler.Validate(context.Background(), f4UpdateAttrs(newProject, oldProject, f4User("uam-member")), nil); err != nil {
		t.Fatalf("an authorized change on a project that records no owner was rejected: %v", err)
	}
}

func TestFuncZZUnchangedMembersNeedNoPermission(t *testing.T) {
	owner := f4Human("owner")
	oldProject := f4Project([]core.ProjectMember{
		s4MemberForFunc(owner, "admin", "owner"),
		s4MemberForFunc(f4Group("team"), "viewer"),
		s4MemberForFunc(f4ServiceAccount("garden-dummy", "builder"), "viewer"),
	}, &owner)
	newProject := oldProject.DeepCopy()
	description := "another description"
	newProject.Spec.Description = &description

	handler := f4Authorizer(t, authorizer.DecisionDeny)
	if err := handler.Validate(context.Background(), f4UpdateAttrs(newProject, oldProject, f4User("member")), nil); err != nil {
		t.Fatalf("an update that leaves the member list unchanged was rejected: %v", err)
	}
}

func s4MemberForFunc(subject rbacv1.Subject, roles ...string) core.ProjectMember {
	return core.ProjectMember{Subject: subject, Roles: roles}
}

// TestFuncZZDeniedUserMemberChangeIsRefused is the positive control for the member check: a human
// member change without the manage-members permission is refused.
func TestFuncZZDeniedUserMemberChangeIsRefused(t *testing.T) {
	owner := f4Human("owner")
	oldProject := f4Project([]core.ProjectMember{s4MemberForFunc(owner, "admin", "owner")}, &owner)
	newProject := oldProject.DeepCopy()
	newProject.Spec.Members = append(newProject.Spec.Members, s4MemberForFunc(f4Human("mallory"), "viewer"))

	handler := f4Authorizer(t, authorizer.DecisionDeny)
	if err := handler.Validate(context.Background(), f4UpdateAttrs(newProject, oldProject, f4User("mallory")), nil); err == nil {
		t.Fatal("a user was added to the project member list without the manage-members permission")
	}
}
