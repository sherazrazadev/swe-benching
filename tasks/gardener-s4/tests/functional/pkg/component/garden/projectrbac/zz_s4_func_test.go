// SPDX-FileCopyrightText: SAP SE or an SAP affiliate company and Gardener contributors
//
// SPDX-License-Identifier: Apache-2.0

package projectrbac_test

import (
	"context"
	"testing"

	corev1 "k8s.io/api/core/v1"
	rbacv1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"sigs.k8s.io/controller-runtime/pkg/client"
	fakeclient "sigs.k8s.io/controller-runtime/pkg/client/fake"

	gardencorev1beta1 "github.com/gardener/gardener/pkg/apis/core/v1beta1"
	"github.com/gardener/gardener/pkg/client/kubernetes"
	. "github.com/gardener/gardener/pkg/component/garden/projectrbac"
)

func funcZZBindingSubjects(t *testing.T, c client.Client, bindingName string) []rbacv1.Subject {
	t.Helper()

	binding := &rbacv1.ClusterRoleBinding{}
	if err := c.Get(context.Background(), client.ObjectKey{Name: bindingName}, binding); err != nil {
		t.Fatalf("getting cluster role binding %q: %v", bindingName, err)
	}
	return binding.Subjects
}

func funcZZContains(subjects []rbacv1.Subject, subject rbacv1.Subject) bool {
	for _, candidate := range subjects {
		if candidate == subject {
			return true
		}
	}
	return false
}

// TestFuncZZOrdinaryRenderingKeepsWorking checks that the ordinary project access rendering is not
// disturbed by unrelated stored configuration in the project namespace.
func TestFuncZZOrdinaryRenderingKeepsWorking(t *testing.T) {
	ctx := context.Background()
	projectName := "dummy"
	namespace := "garden-" + projectName

	owner := rbacv1.Subject{APIGroup: rbacv1.GroupName, Kind: rbacv1.UserKind, Name: "owner"}
	admin := rbacv1.Subject{APIGroup: rbacv1.GroupName, Kind: rbacv1.UserKind, Name: "admin"}
	viewer := rbacv1.Subject{APIGroup: rbacv1.GroupName, Kind: rbacv1.GroupKind, Name: "viewers"}

	c := fakeclient.NewClientBuilder().WithScheme(kubernetes.GardenScheme).Build()

	unrelated := &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{Name: "unrelated-project-config", Namespace: namespace},
		Data:       map[string]string{"some": "value"},
	}
	if err := c.Create(ctx, unrelated); err != nil {
		t.Fatalf("creating unrelated configuration: %v", err)
	}

	project := &gardencorev1beta1.Project{
		ObjectMeta: metav1.ObjectMeta{Name: projectName},
		Spec: gardencorev1beta1.ProjectSpec{
			Namespace: &namespace,
			Owner:     &owner,
			Members: []gardencorev1beta1.ProjectMember{
				{Subject: owner, Roles: []string{"admin", "owner"}},
				{Subject: admin, Roles: []string{"admin"}},
				{Subject: viewer, Roles: []string{"viewer"}},
			},
		},
	}

	projectRBAC, err := New(c, project)
	if err != nil {
		t.Fatalf("creating the project RBAC component: %v", err)
	}
	if err := projectRBAC.Deploy(ctx); err != nil {
		t.Fatalf("reconciling project RBAC: %v", err)
	}

	adminSubjects := funcZZBindingSubjects(t, c, "gardener.cloud:system:project:"+projectName)
	if !funcZZContains(adminSubjects, owner) {
		t.Fatalf("the project owner is no longer bound to the project admin role: %v", adminSubjects)
	}

	memberSubjects := funcZZBindingSubjects(t, c, "gardener.cloud:system:project-member:"+projectName)
	if !funcZZContains(memberSubjects, admin) || !funcZZContains(memberSubjects, owner) {
		t.Fatalf("project admin members are no longer bound to the project member role: %v", memberSubjects)
	}

	viewerSubjects := funcZZBindingSubjects(t, c, "gardener.cloud:system:project-viewer:"+projectName)
	if !funcZZContains(viewerSubjects, viewer) {
		t.Fatalf("a viewer group is no longer bound to the project viewer role: %v", viewerSubjects)
	}
}
