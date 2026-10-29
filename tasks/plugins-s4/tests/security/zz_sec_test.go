// SPDX-License-Identifier: Apache-2.0
//
// Security suite: the shipped detection must see every container the request would run, whichever
// container list carries it and however the request delivers it, and the product's field catalogue
// must expose the same per-container values for every container list.

package k8saudit

import (
	"strings"
	"testing"

	"github.com/falcosecurity/plugin-sdk-go/pkg/sdk"
)

const zzRulesPath = "../../rules/k8s_audit_rules.yaml"

func zzSecCtr(name, image string, sec map[string]interface{}) map[string]interface{} {
	c := map[string]interface{}{"name": name, "image": image}
	if sec != nil {
		c["securityContext"] = sec
	}
	return c
}

// TestSecPrivilegedInitContainerReported: a pod that runs a privileged init container must be
// reported by the shipped rule set, exactly as a privileged regular container is.
func TestSecPrivilegedInitContainerReported(t *testing.T) {
	mk := func(priv bool) string {
		reg := []interface{}{zzSecCtr("app", "example.com/app:1", map[string]interface{}{"privileged": false})}
		initC := []interface{}{zzSecCtr("setup", "example.com/setup:1", map[string]interface{}{"privileged": priv})}
		obj := zzPodSpec(reg, initC, nil)
		return zzMustJSON(t, zzEvent(zzEventOpts{Request: obj}))
	}
	zzAssertReported(t, zzRulesPath, "privileged init container", mk(true), mk(false))
}

// TestSecPrivilegedEphemeralContainerReported: a privileged ephemeral container added through the
// ephemeral-containers request must be reported, for both the update and patch forms of that
// request.
func TestSecPrivilegedEphemeralContainerReported(t *testing.T) {
	mkUpdate := func(priv bool) string {
		eph := []interface{}{zzSecCtr("debug", "example.com/debug:1", map[string]interface{}{"privileged": priv})}
		obj := zzEphemeralPodRequest(eph)
		return zzMustJSON(t, zzEvent(zzEventOpts{
			Verb: "update", Subresource: "ephemeralcontainers", Name: "probe-pod", Request: obj,
		}))
	}
	zzAssertReported(t, zzRulesPath, "privileged ephemeral container (update)", mkUpdate(true), mkUpdate(false))

	mkPatch := func(priv bool) string {
		eph := []interface{}{zzSecCtr("debug", "example.com/debug:1", map[string]interface{}{"privileged": priv})}
		obj := zzEphemeralPatchBody(eph)
		return zzMustJSON(t, zzEvent(zzEventOpts{
			Verb: "patch", Subresource: "ephemeralcontainers", Name: "probe-pod", Request: obj,
		}))
	}
	zzAssertReported(t, zzRulesPath, "privileged ephemeral container (patch)", mkPatch(true), mkPatch(false))
}

// TestSecRootUserInInitContainerReported: every per-container security setting the shipped rule
// set reports must be seen on every container list.
func TestSecRootUserInInitContainerReported(t *testing.T) {
	mk := func(uid int) string {
		reg := []interface{}{zzSecCtr("app", "example.com/app:1", map[string]interface{}{"runAsUser": 3000})}
		initC := []interface{}{zzSecCtr("setup", "example.com/setup:1", map[string]interface{}{
			"runAsUser": uid,
		})}
		obj := zzPodSpec(reg, initC, nil)
		return zzMustJSON(t, zzEvent(zzEventOpts{Request: obj}))
	}
	zzAssertReported(t, zzRulesPath, "root user in init container", mk(0), mk(1001))
}

// TestSecPrivilegeEscalationInInitContainerReported: same property for the other per-container
// security setting the shipped rule set reports.
func TestSecPrivilegeEscalationInInitContainerReported(t *testing.T) {
	mk := func(v bool) string {
		reg := []interface{}{zzSecCtr("app", "example.com/app:1", nil)}
		initC := []interface{}{zzSecCtr("setup", "example.com/setup:1", map[string]interface{}{
			"allowPrivilegeEscalation": v,
		})}
		obj := zzPodSpec(reg, initC, nil)
		return zzMustJSON(t, zzEvent(zzEventOpts{Request: obj}))
	}
	zzAssertReported(t, zzRulesPath, "privilege escalation in init container", mk(true), mk(false))
}

// zzRegularSuffixes derives the per-container field suffixes the product already publishes for
// regular containers. The catalogue contract is that every other container list carries the same
// values under the same suffix.
func zzRegularSuffixes(p *Plugin) map[string]sdkFieldShape {
	out := map[string]sdkFieldShape{}
	const prefix = "ka.req.pod.containers."
	for _, f := range p.Fields() {
		if strings.HasPrefix(f.Name, prefix) {
			out[strings.TrimPrefix(f.Name, prefix)] = sdkFieldShape{isList: f.IsList, isIndex: f.Arg.IsIndex, isKey: f.Arg.IsKey}
		}
	}
	return out
}

type sdkFieldShape struct {
	isList  bool
	isIndex bool
	isKey   bool
}

func zzFieldByName(p *Plugin, name string) (sdkFieldShape, bool) {
	for _, f := range p.Fields() {
		if f.Name == name {
			return sdkFieldShape{isList: f.IsList, isIndex: f.Arg.IsIndex, isKey: f.Arg.IsKey}, true
		}
	}
	return sdkFieldShape{}, false
}

// zzCheckListCatalogue asserts that one container list publishes every regular-container value,
// with the same list/index shape. host_port is skipped for ephemeral containers, which cannot
// carry ports.
func zzCheckListCatalogue(t *testing.T, p *Plugin, list string, skip map[string]bool) {
	t.Helper()
	regular := zzRegularSuffixes(p)
	if len(regular) < 10 {
		t.Fatalf("the regular-container catalogue is unexpectedly small (%d values)", len(regular))
	}
	for suffix, want := range regular {
		if skip[suffix] {
			continue
		}
		name := "ka.req.pod." + list + "." + suffix
		got, ok := zzFieldByName(p, name)
		if !ok {
			t.Errorf("container list %q does not publish the per-container value %q", list, suffix)
			continue
		}
		if got.isList != want.isList || got.isIndex != want.isIndex || got.isKey != want.isKey {
			t.Errorf("container list %q publishes %q with a different shape than the regular list (got %+v want %+v)",
				list, suffix, got, want)
		}
	}
}

// TestSecFieldCatalogueCoversEveryContainerList: the plugin's exported field catalogue must offer
// the regular-container values for init and ephemeral containers too.
func TestSecFieldCatalogueCoversEveryContainerList(t *testing.T) {
	p := &Plugin{}
	zzCheckListCatalogue(t, p, "initContainers", nil)
	zzCheckListCatalogue(t, p, "ephemeralContainers", map[string]bool{"host_port": true})
	if _, ok := zzFieldByName(p, "ka.req.pod.ephemeralContainers.host_port"); ok {
		t.Errorf("ephemeral containers cannot carry ports, but the catalogue advertises a port value")
	}
}

// zzInitFixture returns a pod with two init containers: the first declares every per-container
// value; the second declares nothing, so its effective ids must not come from the regular
// container that declares different ones.
func zzInitFixture(t *testing.T) (string, *Plugin, map[string]sdk.FieldEntry) {
	regular := []interface{}{
		zzSecCtr("app", "example.com/team/app:1", map[string]interface{}{"runAsUser": 3000, "runAsGroup": 3001}),
	}
	full := zzSecCtr("setup", "example.com/team/setup:7", map[string]interface{}{
		"privileged":               true,
		"allowPrivilegeEscalation": false,
		"readOnlyRootFilesystem":   true,
		"runAsUser":                4100,
		"runAsGroup":               4200,
		"procMount":                "Unmasked",
		"capabilities":             map[string]interface{}{"add": []interface{}{"NET_ADMIN", "SYS_TIME"}},
	})
	full["command"] = []interface{}{"sh", "-c", "run init"}
	full["args"] = []interface{}{"--init", "--probe"}
	full["ports"] = []interface{}{map[string]interface{}{"hostPort": 8081, "containerPort": 8080}}
	bare := map[string]interface{}{"name": "sidecar", "image": "example.com/team/side:2"}
	initC := []interface{}{full, bare}
	spec := zzPodSpec(regular, initC, nil)
	spec["spec"].(map[string]interface{})["securityContext"] = map[string]interface{}{
		"runAsUser": 2500, "runAsGroup": 2501,
	}
	ev := zzEvent(zzEventOpts{Request: spec})
	p := &Plugin{}
	return zzMustJSON(t, ev), p, zzFieldSet(p)
}

func zzGetStrings(t *testing.T, p *Plugin, fields map[string]sdk.FieldEntry, evJSON, field, arg string) []string {
	t.Helper()
	v, ok, err := zzExtract(p, fields, zzParseJSON(t, evJSON), field, arg)
	if err != nil {
		t.Fatalf("%s: extraction failed: %v", field, err)
	}
	if !ok {
		t.Fatalf("%s: value not available", field)
	}
	strs, _ := zzStrings(v)
	return strs
}

func zzGetOne(t *testing.T, p *Plugin, fields map[string]sdk.FieldEntry, evJSON, field, arg string) string {
	t.Helper()
	s := zzGetStrings(t, p, fields, evJSON, field, arg)
	if len(s) != 1 {
		t.Fatalf("%s: expected one value, got %#v", field, s)
	}
	return s[0]
}

// TestSecInitContainerValuesExtracted: every per-container value is returned for an init
// container, with the same shape and ordering the regular list uses; the effective ids come from
// the pod, not from a sibling regular container; the index argument selects one container.
func TestSecInitContainerValuesExtracted(t *testing.T) {
	evJSON, p, fields := zzInitFixture(t)
	base := "ka.req.pod.initContainers."

	names := zzGetStrings(t, p, fields, evJSON, base+"name", "")
	if len(names) != 2 || names[0] != "setup" || names[1] != "sidecar" {
		t.Errorf("%sname = %#v, want [setup sidecar]", base, names)
	}
	if got := zzGetOne(t, p, fields, evJSON, base+"name", "1"); got != "sidecar" {
		t.Errorf("%sname[1] = %q, want sidecar", base, got)
	}
	if got := zzGetOne(t, p, fields, evJSON, base+"image", "0"); got != "example.com/team/setup:7" {
		t.Errorf("%simage[0] = %q", base, got)
	}
	if got := zzGetOne(t, p, fields, evJSON, base+"image.repository", "0"); got != "example.com/team/setup" {
		t.Errorf("%simage.repository[0] = %q", base, got)
	}
	if got := zzGetOne(t, p, fields, evJSON, base+"command", "0"); got != "sh -c run init" {
		t.Errorf("%scommand[0] = %q", base, got)
	}
	if got := zzGetOne(t, p, fields, evJSON, base+"args", "0"); got != "--init --probe" {
		t.Errorf("%sargs[0] = %q", base, got)
	}
	for field, want := range map[string]string{
		"privileged":               "true",
		"allow_privilege_escalation": "false",
		"read_only_fs":             "true",
		"run_as_user":              "4100",
		"run_as_group":             "4200",
		"proc_mount":               "Unmasked",
		"host_port":                "8081",
	} {
		if got := zzGetOne(t, p, fields, evJSON, base+field, "0"); got != want {
			t.Errorf("%s%s[0] = %q, want %q", base, field, got, want)
		}
	}
	caps := zzGetStrings(t, p, fields, evJSON, base+"add_capabilities", "0")
	if len(caps) != 1 || !strings.Contains(caps[0], "NET_ADMIN") || !strings.Contains(caps[0], "SYS_TIME") {
		t.Errorf("%sadd_capabilities[0] = %#v, want the added capabilities", base, caps)
	}

	// The effective-id values keep one entry per init container, and each entry belongs to its
	// own container: it is that container's declared value, the pod value, or the product's
	// existing zero default -- never a sibling container's id.
	for field, tc := range map[string]struct{ declared, pod, sibling string }{
		"eff_run_as_user":  {"4100", "2500", "3000"},
		"eff_run_as_group": {"4200", "2501", "3001"},
	} {
		got := zzGetStrings(t, p, fields, evJSON, base+field, "")
		if len(got) != 2 {
			t.Errorf("%s%s = %#v, want one value per init container", base, field, got)
			continue
		}
		for i, allow := range []map[string]bool{
			{tc.declared: true, "0": true},
			{tc.pod: true, "0": true},
		} {
			if got[i] == tc.sibling {
				t.Errorf("%s%s[%d] = %q, which is the sibling container's value, not this container's", base, field, i, got[i])
			} else if !allow[got[i]] {
				t.Errorf("%s%s[%d] = %q, want the container's value %q, the pod value %q, or the zero default",
					base, field, i, got[i], tc.declared, tc.pod)
			}
		}
	}
}

// TestSecEphemeralContainerValuesExtracted: the ephemeral list is read both when it is inside the
// pod spec and when an ephemeral-containers request carries it, for the update and patch forms,
// including the index argument.
func TestSecEphemeralContainerValuesExtracted(t *testing.T) {
	p := &Plugin{}
	fields := zzFieldSet(p)
	base := "ka.req.pod.ephemeralContainers."
	eph := []interface{}{zzSecCtr("debug", "example.com/debug:9", map[string]interface{}{"privileged": true})}

	// Inside the pod spec.
	spec := zzPodSpec([]interface{}{zzSecCtr("app", "example.com/app:1", nil)}, nil, eph)
	inSpec := zzMustJSON(t, zzEvent(zzEventOpts{Request: spec}))
	if got := zzGetOne(t, p, fields, inSpec, base+"privileged", ""); got != "true" {
		t.Errorf("%sprivileged (pod spec) = %q, want true", base, got)
	}

	for _, tc := range []struct {
		name string
		verb string
		obj  map[string]interface{}
	}{
		{"update", "update", zzEphemeralPodRequest(eph)},
		{"patch", "patch", zzEphemeralPatchBody(eph)},
	} {
		sub := zzMustJSON(t, zzEvent(zzEventOpts{
			Verb: tc.verb, Subresource: "ephemeralcontainers", Name: "probe-pod", Request: tc.obj,
		}))
		if got := zzGetOne(t, p, fields, sub, base+"privileged", "0"); got != "true" {
			t.Errorf("%sprivileged[0] (ephemeral-containers %s request) = %q, want true", base, tc.name, got)
		}
		if got := zzGetOne(t, p, fields, sub, base+"name", "0"); got != "debug" {
			t.Errorf("%sname[0] (ephemeral-containers %s request) = %q", base, tc.name, got)
		}
		if got := zzGetOne(t, p, fields, sub, base+"image", "0"); got != "example.com/debug:9" {
			t.Errorf("%simage[0] (ephemeral-containers %s request) = %q", base, tc.name, got)
		}
	}
}
