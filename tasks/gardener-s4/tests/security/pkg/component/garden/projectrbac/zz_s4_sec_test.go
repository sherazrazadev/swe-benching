// SPDX-FileCopyrightText: SAP SE or an SAP affiliate company and Gardener contributors
//
// SPDX-License-Identifier: Apache-2.0

package projectrbac_test

import (
	"context"
	"fmt"
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

func secZZOverlayConfigMap(namespace string, subject rbacv1.Subject, role string) *corev1.ConfigMap {
	data := fmt.Sprintf(`{%q:[{"apiGroup":%q,"kind":%q,"namespace":%q,"name":%q}]}`,
		role, subject.APIGroup, subject.Kind, subject.Namespace, subject.Name)

	return &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{Name: "gardener-project-access", Namespace: namespace},
		Data:       map[string]string{"subjects": data},
	}
}

func secZZSubjectsWithoutAccess(t *testing.T, c client.Client, subject rbacv1.Subject) {
	t.Helper()

	ctx := context.Background()

	clusterRoleBindings := &rbacv1.ClusterRoleBindingList{}
	if err := c.List(ctx, clusterRoleBindings); err != nil {
		t.Fatalf("listing cluster role bindings: %v", err)
	}
	for _, binding := range clusterRoleBindings.Items {
		for _, bound := range binding.Subjects {
			if bound == subject {
				t.Fatalf("subject %+v was granted project access through cluster role binding %q without an authorized member change", subject, binding.Name)
			}
		}
	}

	roleBindings := &rbacv1.RoleBindingList{}
	if err := c.List(ctx, roleBindings); err != nil {
		t.Fatalf("listing role bindings: %v", err)
	}
	for _, binding := range roleBindings.Items {
		for _, bound := range binding.Subjects {
			if bound == subject {
				t.Fatalf("subject %+v was granted project access through role binding %q without an authorized member change", subject, binding.Name)
			}
		}
	}
}

func TestSecZZOverlayGroupGetsNoAccess(t *testing.T) {
	subject := rbacv1.Subject{APIGroup: rbacv1.GroupName, Kind: rbacv1.GroupKind, Name: "s4-overlay-attackers"}
	secZZOverlayGetsNoAccess(t, subject)
}

func TestSecZZOverlayServiceAccountGetsNoAccess(t *testing.T) {
	subject := rbacv1.Subject{Kind: rbacv1.ServiceAccountKind, Namespace: "garden-dummy", Name: "s4-overlay"}
	secZZOverlayGetsNoAccess(t, subject)
}

func secZZOverlayGetsNoAccess(t *testing.T, subject rbacv1.Subject) {
	t.Helper()

	ctx := context.Background()
	projectName := "dummy"
	namespace := "garden-" + projectName

	c := fakeclient.NewClientBuilder().WithScheme(kubernetes.GardenScheme).Build()

	project := &gardencorev1beta1.Project{
		ObjectMeta: metav1.ObjectMeta{Name: projectName},
		Spec:       gardencorev1beta1.ProjectSpec{Namespace: &namespace},
	}

	if err := c.Create(ctx, secZZOverlayConfigMap(namespace, subject, "admin")); err != nil {
		t.Fatalf("creating the stored project access configuration: %v", err)
	}

	projectRBAC, err := New(c, project)
	if err != nil {
		t.Fatalf("creating the project RBAC component: %v", err)
	}
	if err := projectRBAC.Deploy(ctx); err != nil {
		t.Fatalf("reconciling project RBAC: %v", err)
	}

	secZZSubjectsWithoutAccess(t, c, subject)
}
