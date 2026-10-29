// SPDX-License-Identifier: Apache-2.0
//
// Functional suite: legitimate behaviour that must not change. Every case here passes on the
// pinned tree; a fix that widens a per-container value, changes a deprecated summary, or reports
// requests that are allowed today breaks one of them.

package k8saudit

import (
	"strings"
	"testing"
)

func zzFuncCtr(name, image string, sec map[string]interface{}) map[string]interface{} {
	c := map[string]interface{}{"name": name, "image": image}
	if sec != nil {
		c["securityContext"] = sec
	}
	return c
}

// TestFuncRegularPrivilegedPodStillReported: the positive control. A privileged regular container
// with an untrusted image is reported, as it is today.
func TestFuncRegularPrivilegedPodStillReported(t *testing.T) {
	mk := func(priv bool) string {
		reg := []interface{}{zzFuncCtr("app", "example.com/app:1", map[string]interface{}{"privileged": priv})}
		spec := zzPodSpec(reg, nil, nil)
		return zzMustJSON(t, zzEvent(zzEventOpts{Request: spec}))
	}
	zzAssertReported(t, zzRulesPath, "privileged regular container", mk(true), mk(false))
}

// TestFuncTrustedImageExceptionStillSuppresses: the shipped trusted-image allowance keeps
// suppressing a privileged pod whose regular container image is trusted, even when another
// container list carries a different image.
func TestFuncTrustedImageExceptionStillSuppresses(t *testing.T) {
	mk := func(priv bool) string {
		reg := []interface{}{zzFuncCtr("app", "docker.io/calico/node", map[string]interface{}{"privileged": priv})}
		initC := []interface{}{zzFuncCtr("setup", "example.com/other:1", nil)}
		spec := zzPodSpec(reg, initC, nil)
		return zzMustJSON(t, zzEvent(zzEventOpts{Request: spec}))
	}
	zzAssertNotReported(t, zzRulesPath, "privileged pod with a trusted image", mk(true), mk(false))

	// Control: the same pod with an untrusted image is still reported.
	mkU := func(priv bool) string {
		reg := []interface{}{zzFuncCtr("app", "example.com/app:1", map[string]interface{}{"privileged": priv})}
		spec := zzPodSpec(reg, nil, nil)
		return zzMustJSON(t, zzEvent(zzEventOpts{Request: spec}))
	}
	zzAssertReported(t, zzRulesPath, "privileged pod with an untrusted image", mkU(true), mkU(false))

	// A trusted image in another container list does not suppress a privileged regular container
	// with an untrusted image: the allowance keeps its existing scope.
	mkT := func(priv bool) string {
		reg := []interface{}{zzFuncCtr("app", "example.com/app:1", map[string]interface{}{"privileged": priv})}
		initC := []interface{}{zzFuncCtr("setup", "docker.io/calico/node", nil)}
		spec := zzPodSpec(reg, initC, nil)
		return zzMustJSON(t, zzEvent(zzEventOpts{Request: spec}))
	}
	zzAssertReported(t, zzRulesPath, "privileged untrusted regular container with a trusted sibling image", mkT(true), mkT(false))
}

// TestFuncRegularContainerValuesStayScoped: values published as per-regular-container keep
// covering only regular containers and stay index-aligned with each other.
func TestFuncRegularContainerValuesStayScoped(t *testing.T) {
	regular := []interface{}{zzFuncCtr("app", "example.com/reg:1", map[string]interface{}{"privileged": false})}
	initC := []interface{}{zzFuncCtr("setup", "example.com/init:1", map[string]interface{}{"privileged": true})}
	eph := []interface{}{zzFuncCtr("debug", "example.com/eph:1", map[string]interface{}{"privileged": true})}
	spec := zzPodSpec(regular, initC, eph)
	evJSON := zzMustJSON(t, zzEvent(zzEventOpts{Request: spec}))
	p := &Plugin{}
	fields := zzFieldSet(p)

	for _, c := range []struct {
		field string
		want  []string
	}{
		{"name", []string{"app"}},
		{"image", []string{"example.com/reg:1"}},
		{"image.repository", []string{"example.com/reg"}},
		{"privileged", []string{"false"}},
	} {
		got := zzGetStrings(t, p, fields, evJSON, "ka.req.pod.containers."+c.field, "")
		if len(got) != len(c.want) {
			t.Errorf("ka.req.pod.containers.%s = %#v, want only the regular container's values %#v", c.field, got, c.want)
			continue
		}
		for i := range got {
			if got[i] != c.want[i] {
				t.Errorf("ka.req.pod.containers.%s = %#v, want %#v", c.field, got, c.want)
			}
		}
	}
	repo := zzGetStrings(t, p, fields, evJSON, "ka.req.pod.containers.image.repository", "")
	priv := zzGetStrings(t, p, fields, evJSON, "ka.req.pod.containers.privileged", "")
	if len(repo) != len(priv) {
		t.Errorf("per-regular-container values are no longer index-aligned: image.repository=%d privileged=%d", len(repo), len(priv))
	}
}

// TestFuncDeprecatedSummariesUnchanged: the deprecated per-pod summaries keep summarising the same
// list they summarise today.
func TestFuncDeprecatedSummariesUnchanged(t *testing.T) {
	p := &Plugin{}
	fields := zzFieldSet(p)

	// Only an init container is privileged: the deprecated summary stays false.
	reg := []interface{}{zzFuncCtr("app", "example.com/reg:1", map[string]interface{}{"privileged": false})}
	initC := []interface{}{zzFuncCtr("setup", "example.com/init:1", map[string]interface{}{"privileged": true})}
	evJSON := zzMustJSON(t, zzEvent(zzEventOpts{Request: zzPodSpec(reg, initC, nil)}))
	if got := zzGetOne(t, p, fields, evJSON, "ka.req.container.privileged", ""); got != "false" {
		t.Errorf("ka.req.container.privileged = %q with only an init container privileged, want false", got)
	}
	if got := zzGetOne(t, p, fields, evJSON, "ka.req.container.image", ""); got != "example.com/reg:1" {
		t.Errorf("ka.req.container.image = %q, want the first regular container's image", got)
	}
	if got := zzGetOne(t, p, fields, evJSON, "ka.req.container.image.repository", ""); got != "example.com/reg" {
		t.Errorf("ka.req.container.image.repository = %q, want the first regular container's repository", got)
	}

	// An ephemeral container is privileged while the regular list is not: the deprecated summary
	// still describes the regular list only.
	eph := []interface{}{zzFuncCtr("debug", "example.com/eph:1", map[string]interface{}{"privileged": true})}
	ev3 := zzMustJSON(t, zzEvent(zzEventOpts{Request: zzPodSpec(reg, nil, eph)}))
	if got := zzGetOne(t, p, fields, ev3, "ka.req.container.privileged", ""); got != "false" {
		t.Errorf("ka.req.container.privileged = %q with only an ephemeral container privileged, want false", got)
	}
	if got := zzGetOne(t, p, fields, ev3, "ka.req.container.image", ""); got != "example.com/reg:1" {
		t.Errorf("ka.req.container.image = %q with only an ephemeral container privileged, want the first regular container's image", got)
	}

	// A privileged regular container still makes the deprecated summary true.
	reg2 := []interface{}{zzFuncCtr("app", "example.com/reg:1", map[string]interface{}{"privileged": true})}
	ev2 := zzMustJSON(t, zzEvent(zzEventOpts{Request: zzPodSpec(reg2, nil, nil)}))
	if got := zzGetOne(t, p, fields, ev2, "ka.req.container.privileged", ""); got != "true" {
		t.Errorf("ka.req.container.privileged = %q for a privileged regular container, want true", got)
	}
}

// TestFuncBenignEphemeralAttachmentStillNoticed: attaching a non-privileged ephemeral container
// keeps raising the shipped attachment notice, for both the update and patch forms of the request.
func TestFuncBenignEphemeralAttachmentStillNoticed(t *testing.T) {
	eph := []interface{}{zzFuncCtr("debug", "example.com/debug:1", map[string]interface{}{"privileged": false})}
	rs := zzLoadRules(t, zzRulesPath)
	for _, tc := range []struct {
		name string
		verb string
		obj  map[string]interface{}
	}{
		{"update", "update", zzEphemeralPodRequest(eph)},
		{"patch", "patch", zzEphemeralPatchBody(eph)},
	} {
		ev := zzMustJSON(t, zzEvent(zzEventOpts{
			Verb: tc.verb, Subresource: "ephemeralcontainers", Name: "probe-pod", Request: tc.obj,
		}))
		fired, _ := zzFired(t, rs, ev)
		noticed := false
		for _, r := range rs.rules {
			if !fired[r.Name] {
				continue
			}
			text := strings.ToLower(r.Name + " " + r.Desc + " " + r.Output)
			if strings.Contains(text, "ephemeral") {
				noticed = true
				break
			}
		}
		if !noticed {
			t.Errorf("a benign ephemeral-container %s request no longer raises the shipped attachment notice", tc.name)
		}
	}
}

// TestFuncAbsentSecurityContextIsSkipped: containers without a security context are skipped, not
// an error.
func TestFuncAbsentSecurityContextIsSkipped(t *testing.T) {
	regular := []interface{}{
		zzFuncCtr("plain", "example.com/a:1", nil),
		map[string]interface{}{"name": "empty", "image": "example.com/b:1", "securityContext": map[string]interface{}{}},
	}
	evJSON := zzMustJSON(t, zzEvent(zzEventOpts{Request: zzPodSpec(regular, nil, nil)}))
	p := &Plugin{}
	fields := zzFieldSet(p)
	got := zzGetStrings(t, p, fields, evJSON, "ka.req.pod.containers.privileged", "")
	if len(got) != 0 {
		t.Errorf("ka.req.pod.containers.privileged = %#v for containers without a security context, want no values", got)
	}
	if got := zzGetOne(t, p, fields, evJSON, "ka.req.container.privileged", ""); got != "false" {
		t.Errorf("ka.req.container.privileged = %q, want false", got)
	}
}

// TestFuncIndexOrderingAndJoinsPreserved: the index argument, list order, and the space-joined
// command/args shape keep working for regular containers.
func TestFuncIndexOrderingAndJoinsPreserved(t *testing.T) {
	regular := []interface{}{
		zzFuncCtr("first", "example.com/a:1", nil),
		zzFuncCtr("second", "example.com/b:1", nil),
		zzFuncCtr("third", "example.com/c:1", nil),
	}
	regular[2].(map[string]interface{})["args"] = []interface{}{"--x", "--y"}
	regular[1].(map[string]interface{})["command"] = []interface{}{"run", "serve"}
	evJSON := zzMustJSON(t, zzEvent(zzEventOpts{Request: zzPodSpec(regular, nil, nil)}))
	p := &Plugin{}
	fields := zzFieldSet(p)

	names := zzGetStrings(t, p, fields, evJSON, "ka.req.pod.containers.name", "")
	if len(names) != 3 || names[0] != "first" || names[1] != "second" || names[2] != "third" {
		t.Errorf("ka.req.pod.containers.name = %#v, want declaration order", names)
	}
	if got := zzGetOne(t, p, fields, evJSON, "ka.req.pod.containers.name", "1"); got != "second" {
		t.Errorf("ka.req.pod.containers.name[1] = %q, want second", got)
	}
	if got := zzGetOne(t, p, fields, evJSON, "ka.req.pod.containers.command", "1"); got != "run serve" {
		t.Errorf("ka.req.pod.containers.command[1] = %q, want a space-joined command", got)
	}
	if got := zzGetOne(t, p, fields, evJSON, "ka.req.pod.containers.args", "2"); got != "--x --y" {
		t.Errorf("ka.req.pod.containers.args[2] = %q, want a space-joined argument list", got)
	}
}

// TestFuncRegularHostPortsAndNoEphemeralPorts: host ports keep being published for containers, and
// a container list that cannot carry ports does not advertise them.
func TestFuncRegularHostPortsAndNoEphemeralPorts(t *testing.T) {
	regular := []interface{}{zzFuncCtr("app", "example.com/a:1", nil)}
	regular[0].(map[string]interface{})["ports"] = []interface{}{
		map[string]interface{}{"hostPort": 8081, "containerPort": 8080},
	}
	evJSON := zzMustJSON(t, zzEvent(zzEventOpts{Request: zzPodSpec(regular, nil, nil)}))
	p := &Plugin{}
	fields := zzFieldSet(p)
	if got := zzGetOne(t, p, fields, evJSON, "ka.req.pod.containers.host_port", "0"); got != "8081" {
		t.Errorf("ka.req.pod.containers.host_port[0] = %q, want 8081", got)
	}
	if _, ok := zzFieldByName(p, "ka.req.pod.ephemeralContainers.host_port"); ok {
		t.Errorf("ephemeral containers cannot carry ports, but the catalogue advertises a port value")
	}
}

// TestFuncNonPrivilegedPodAddsNoDetection: a pod with no privileged container makes no rule fire
// that the same pod with a privileged regular container does not also make fire.
func TestFuncNonPrivilegedPodAddsNoDetection(t *testing.T) {
	mk := func(priv bool) string {
		reg := []interface{}{zzFuncCtr("app", "example.com/app:1", map[string]interface{}{"privileged": priv})}
		initC := []interface{}{zzFuncCtr("setup", "example.com/init:1", map[string]interface{}{"privileged": false})}
		return zzMustJSON(t, zzEvent(zzEventOpts{Request: zzPodSpec(reg, initC, nil)}))
	}
	rs := zzLoadRules(t, zzRulesPath)
	nonpriv, _ := zzFired(t, rs, mk(false))
	priv, _ := zzFired(t, rs, mk(true))
	var extra []string
	for name := range nonpriv {
		if !priv[name] {
			extra = append(extra, name)
		}
	}
	if len(extra) > 0 {
		t.Fatalf("a non-privileged pod raises detections that a privileged pod does not: %v", extra)
	}
}

// TestFuncAllowedPodsRaiseNoPrivilegedAlert: a pod that is not privileged, and a privileged pod
// whose regular image is trusted, must not raise any rule that describes itself as a privileged
// detection.
func TestFuncAllowedPodsRaiseNoPrivilegedAlert(t *testing.T) {
	nonPriv := []interface{}{zzFuncCtr("app", "example.com/app:1", map[string]interface{}{"privileged": false})}
	nonPrivJSON := zzMustJSON(t, zzEvent(zzEventOpts{Request: zzPodSpec(nonPriv, nil, nil)}))
	zzAssertNoAlertMentioning(t, zzRulesPath, "non-privileged pod", nonPrivJSON, "privileged")

	trusted := []interface{}{zzFuncCtr("app", "docker.io/calico/node", map[string]interface{}{"privileged": true})}
	trustedJSON := zzMustJSON(t, zzEvent(zzEventOpts{Request: zzPodSpec(trusted, nil, nil)}))
	zzAssertNoAlertMentioning(t, zzRulesPath, "trusted-image privileged pod", trustedJSON, "privileged")
}
