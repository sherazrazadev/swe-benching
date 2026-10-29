// SPDX-License-Identifier: Apache-2.0
//
// Test support for the k8s-audit detection properties. These helpers are staged into the
// product package at grading time only; they are not part of the product.

package k8saudit

import (
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"
	"testing"
	"unsafe"

	"github.com/falcosecurity/plugin-sdk-go/pkg/sdk"
	"github.com/valyala/fastjson"
	"gopkg.in/yaml.v3"
)

// ---------------------------------------------------------------- extraction

type zzRequest struct {
	field      string
	fieldType  uint32
	isList     bool
	argPresent bool
	argIndex   uint64
	argKey     string
	value      interface{}
	set        bool
}

func (r *zzRequest) FieldID() uint64            { return 0 }
func (r *zzRequest) FieldType() uint32          { return r.fieldType }
func (r *zzRequest) Field() string              { return r.field }
func (r *zzRequest) ArgKey() string             { return r.argKey }
func (r *zzRequest) ArgIndex() uint64           { return r.argIndex }
func (r *zzRequest) ArgPresent() bool           { return r.argPresent }
func (r *zzRequest) IsList() bool               { return r.isList }
func (r *zzRequest) SetValue(v interface{})     { r.value, r.set = v, true }
func (r *zzRequest) SetPtr(unsafe.Pointer)      {}
func (r *zzRequest) SetOffsetPtrs(_, _ unsafe.Pointer) {}
func (r *zzRequest) WantOffset() bool           { return false }
func (r *zzRequest) SetValueOffset(_, _ uint32) {}

func zzParseJSON(t *testing.T, s string) *fastjson.Value {
	t.Helper()
	v, err := fastjson.Parse(s)
	if err != nil {
		t.Fatalf("parse event JSON: %v", err)
	}
	return v
}

func zzMustJSON(t *testing.T, v interface{}) string {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("marshal event: %v", err)
	}
	return string(b)
}

func zzFieldSet(p *Plugin) map[string]sdk.FieldEntry {
	out := map[string]sdk.FieldEntry{}
	for _, f := range p.Fields() {
		out[f.Name] = f
	}
	return out
}

// zzExtract runs the product's public extraction path for one field. It returns the value the
// plugin set, and false when the field was not available for this event.
func zzExtract(p *Plugin, fields map[string]sdk.FieldEntry, ev *fastjson.Value, name, arg string) (interface{}, bool, error) {
	fe, ok := fields[name]
	if !ok {
		return nil, false, fmt.Errorf("field %q is not registered", name)
	}
	req := &zzRequest{field: name, fieldType: sdk.FieldTypeCharBuf, isList: fe.IsList}
	if arg != "" {
		req.argPresent = true
		if fe.Arg.IsKey {
			req.argKey = arg
		} else if n, err := strconv.ParseUint(arg, 10, 64); err == nil {
			req.argIndex = n
		} else {
			req.argKey = arg
		}
	}
	err := p.ExtractFromJSON(req, ev)
	if err == ErrExtractNotAvailable {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, err
	}
	if !req.set {
		return nil, false, nil
	}
	return req.value, true, nil
}

func zzStrings(v interface{}) ([]string, bool) {
	switch x := v.(type) {
	case string:
		return []string{x}, false
	case []string:
		return x, true
	}
	return nil, false
}

// ---------------------------------------------------------------- audit events

type zzContainer map[string]interface{}

func zzSecCtx(kv map[string]interface{}) map[string]interface{} {
	if kv == nil {
		return nil
	}
	return map[string]interface{}{"securityContext": kv}
}

func zzPodSpec(containers, initC, ephemeral []interface{}) map[string]interface{} {
	spec := map[string]interface{}{"containers": containers}
	if initC != nil {
		spec["initContainers"] = initC
	}
	if ephemeral != nil {
		spec["ephemeralContainers"] = ephemeral
	}
	return map[string]interface{}{
		"apiVersion": "v1",
		"kind":       "Pod",
		"metadata":   map[string]interface{}{"name": "probe-pod", "namespace": "default"},
		"spec":       spec,
	}
}

type zzEventOpts struct {
	Verb        string
	Resource    string
	Subresource string
	User        string
	Namespace   string
	Name        string
	Request     interface{}
	Response    interface{}
	AuditID     string
}

func zzEvent(o zzEventOpts) map[string]interface{} {
	if o.Verb == "" {
		o.Verb = "create"
	}
	if o.Resource == "" {
		o.Resource = "pods"
	}
	if o.User == "" {
		o.User = "kubernetes-admin"
	}
	if o.Namespace == "" {
		o.Namespace = "default"
	}
	if o.Name == "" {
		o.Name = "probe-pod"
	}
	if o.AuditID == "" {
		o.AuditID = "00000000-0000-0000-0000-000000000001"
	}
	ref := map[string]interface{}{
		"resource":  o.Resource,
		"namespace": o.Namespace,
		"name":      o.Name,
	}
	if o.Subresource != "" {
		ref["subresource"] = o.Subresource
	}
	ev := map[string]interface{}{
		"kind":       "Event",
		"apiVersion": "audit.k8s.io/v1",
		"auditID":    o.AuditID,
		"stage":      "ResponseComplete",
		"verb":       o.Verb,
		"user":       map[string]interface{}{"username": o.User},
		"objectRef":  ref,
		"requestObject": o.Request,
		"responseStatus": map[string]interface{}{"code": 200},
	}
	if o.Response != nil {
		ev["responseObject"] = o.Response
	}
	return ev
}

// zzEphemeralPodRequest is the request object of a pods/ephemeralcontainers update: the
// subresource takes a Pod, so the list sits at spec.ephemeralContainers.
func zzEphemeralPodRequest(ephemeral []interface{}) map[string]interface{} {
	regular := []interface{}{map[string]interface{}{"name": "app", "image": "example.com/app:1"}}
	return zzPodSpec(regular, nil, ephemeral)
}

// zzEphemeralPatchBody is the request body of a pods/ephemeralcontainers patch: it carries the
// list under the pod spec, as current clients send it.
func zzEphemeralPatchBody(ephemeral []interface{}) map[string]interface{} {
	return map[string]interface{}{
		"spec": map[string]interface{}{"ephemeralContainers": ephemeral},
	}
}

// ---------------------------------------------------------------- rule model

type zzRule struct {
	Name      string
	Desc      string
	Condition string
	Output    string
	Priority  string
}

type zzRuleSet struct {
	rules  []zzRule
	macros map[string]string
	lists  map[string][]zzLit
}

type zzLit struct {
	Text   string
	Quoted bool
}

func zzLoadRules(t *testing.T, path string) *zzRuleSet {
	t.Helper()
	b, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read shipped rules: %v", err)
	}
	var docs []map[string]interface{}
	if err := yaml.Unmarshal(b, &docs); err != nil {
		t.Fatalf("parse shipped rules: %v", err)
	}
	rs := &zzRuleSet{macros: map[string]string{}, lists: map[string][]zzLit{}}
	for _, d := range docs {
		if v, ok := d["rule"].(string); ok {
			r := zzRule{Name: v}
			r.Desc, _ = d["desc"].(string)
			r.Condition, _ = d["condition"].(string)
			r.Output, _ = d["output"].(string)
			r.Priority, _ = d["priority"].(string)
			rs.rules = append(rs.rules, r)
		}
		if v, ok := d["macro"].(string); ok {
			c, _ := d["condition"].(string)
			rs.macros[v] = c
		}
		if v, ok := d["list"].(string); ok {
			rs.lists[v] = zzItems(d["items"])
		}
	}
	if len(rs.rules) == 0 {
		t.Fatalf("no rules found in %s", path)
	}
	return rs
}

func zzItems(v interface{}) []zzLit {
	var out []zzLit
	switch x := v.(type) {
	case nil:
		return nil
	case []interface{}:
		for _, it := range x {
			switch y := it.(type) {
			case string:
				out = append(out, zzLit{Text: y})
			case int:
				out = append(out, zzLit{Text: strconv.Itoa(y)})
			case int64:
				out = append(out, zzLit{Text: strconv.FormatInt(y, 10)})
			case float64:
				out = append(out, zzLit{Text: strconv.FormatFloat(y, 'f', -1, 64)})
			case bool:
				out = append(out, zzLit{Text: strconv.FormatBool(y)})
			}
		}
	}
	return out
}

// zzEval decides the shipped rule conditions over one audit event. Field values come from the
// product's own extraction path; jevt.* values come from the event JSON. It evaluates condition
// expressions only: Falco `exceptions:` blocks and `override:` overlays are not supported, so a
// condition term is the shipped idiom these rules use.
type zzEval struct {
	plugin *Plugin
	fields map[string]sdk.FieldEntry
	json   *fastjson.Value
	rs     *zzRuleSet
	stack  map[string]bool
	cache  map[string]zzNode
}

func newZZEval(p *Plugin, rs *zzRuleSet, ev *fastjson.Value) *zzEval {
	return &zzEval{plugin: p, fields: zzFieldSet(p), json: ev, rs: rs,
		stack: map[string]bool{}, cache: map[string]zzNode{}}
}

// zzFired returns the names of the shipped rules whose condition holds for the event, plus the
// rules that could not be evaluated (unsupported expression or missing field).
func zzFired(t *testing.T, rs *zzRuleSet, eventJSON string) (map[string]bool, map[string]error) {
	t.Helper()
	p := &Plugin{}
	e := newZZEval(p, rs, zzParseJSON(t, eventJSON))
	fired := map[string]bool{}
	errs := map[string]error{}
	for _, r := range rs.rules {
		if strings.TrimSpace(r.Condition) == "" {
			continue
		}
		node, err := e.node(r.Condition)
		if err != nil {
			errs[r.Name] = err
			continue
		}
		ok, err := e.eval(node)
		if err != nil {
			errs[r.Name] = err
			continue
		}
		if ok {
			fired[r.Name] = true
		}
	}
	return fired, errs
}

// zzAssertReported is the security assertion: the malicious event must make at least one shipped
// rule fire that the otherwise-identical benign event does not. The rule's identity, name and
// layer are irrelevant.
func zzAssertReported(t *testing.T, rulesPath, what, badEvent, goodEvent string) {
	t.Helper()
	rs := zzLoadRules(t, rulesPath)
	bad, badErr := zzFired(t, rs, badEvent)
	good, goodErr := zzFired(t, rs, goodEvent)
	var diff []string
	for name := range bad {
		if !good[name] {
			diff = append(diff, name)
		}
	}
	if len(diff) == 0 {
		t.Fatalf("%s: the shipped rule set does not report this request (no rule fires that the benign request does not); rule evaluation problems: bad=%v good=%v", what, badErr, goodErr)
	}
}

func (e *zzEval) node(cond string) (zzNode, error) {
	p := &zzParser{lex: zzLex(cond)}
	n, err := p.parseExpr()
	if err != nil {
		return nil, err
	}
	if p.peek().kind != zzEOF {
		return nil, fmt.Errorf("unexpected token %q", p.peek().text)
	}
	return n, nil
}

// ---------------------------------------------------------------- evaluator

type zzVal struct {
	Present bool
	IsList  bool
	List    []string
	Str     string
}

func zzSingle(s string) zzVal { return zzVal{Present: true, Str: s} }

func (e *zzEval) eval(n zzNode) (bool, error) {
	switch x := n.(type) {
	case zzOr:
		for _, part := range x.parts {
			ok, err := e.eval(part)
			if err != nil {
				return false, err
			}
			if ok {
				return true, nil
			}
		}
		return false, nil
	case zzAnd:
		for _, part := range x.parts {
			ok, err := e.eval(part)
			if err != nil {
				return false, err
			}
			if !ok {
				return false, nil
			}
		}
		return true, nil
	case zzNot:
		ok, err := e.eval(x.x)
		return !ok, err
	case zzBare:
		return e.bare(x.name)
	case zzCmp:
		return e.compare(x)
	}
	return false, fmt.Errorf("unsupported expression %T", n)
}

func (e *zzEval) bare(name string) (bool, error) {
	switch name {
	case "true":
		return true, nil
	case "false":
		return false, nil
	}
	if _, ok := e.rs.macros[name]; ok {
		return e.macro(name)
	}
	return false, fmt.Errorf("unknown bare identifier %q", name)
}

func (e *zzEval) macro(name string) (bool, error) {
	cond, ok := e.rs.macros[name]
	if !ok {
		return false, fmt.Errorf("unknown macro %q", name)
	}
	if e.stack[name] {
		return false, fmt.Errorf("macro cycle at %q", name)
	}
	node, ok := e.cache[name]
	if !ok {
		var err error
		node, err = e.node(cond)
		if err != nil {
			return false, fmt.Errorf("macro %s: %w", name, err)
		}
		e.cache[name] = node
	}
	e.stack[name] = true
	defer delete(e.stack, name)
	return e.eval(node)
}

func (e *zzEval) compare(c zzCmp) (bool, error) {
	left, err := e.operand(c.left)
	if err != nil {
		return false, err
	}
	switch c.op {
	case "exists":
		return left.Present, nil
	case "nexists":
		return !left.Present, nil
	}
	if c.list != nil {
		set, err := e.expandList(c.list, map[string]bool{})
		if err != nil {
			return false, err
		}
		switch c.op {
		case "in":
			if !left.Present {
				return false, nil
			}
			if left.IsList {
				if len(left.List) == 0 {
					return false, nil
				}
				for _, v := range left.List {
					if !set[v] {
						return false, nil
					}
				}
				return true, nil
			}
			return set[left.Str], nil
		case "intersects":
			if !left.Present {
				return false, nil
			}
			for _, v := range left.values() {
				if set[v] {
					return true, nil
				}
			}
			return false, nil
		}
	}
	right, err := e.operand(c.right)
	if err != nil {
		return false, err
	}
	if !left.Present {
		return false, nil
	}
	switch c.op {
	case "=", "==":
		for _, v := range left.values() {
			if v == right.Str {
				return true, nil
			}
		}
		return false, nil
	case "!=":
		for _, v := range left.values() {
			if v == right.Str {
				return false, nil
			}
		}
		return true, nil
	case "startswith":
		for _, v := range left.values() {
			if strings.HasPrefix(v, right.Str) {
				return true, nil
			}
		}
		return false, nil
	case "endswith":
		for _, v := range left.values() {
			if strings.HasSuffix(v, right.Str) {
				return true, nil
			}
		}
		return false, nil
	case "contains":
		for _, v := range left.values() {
			if strings.Contains(v, right.Str) {
				return true, nil
			}
		}
		return false, nil
	case "<", "<=", ">", ">=":
		lf, lerr := strconv.ParseFloat(left.Str, 64)
		rf, rerr := strconv.ParseFloat(right.Str, 64)
		if lerr != nil || rerr != nil {
			return false, fmt.Errorf("numeric comparison on non-number %q %q", left.Str, right.Str)
		}
		switch c.op {
		case "<":
			return lf < rf, nil
		case "<=":
			return lf <= rf, nil
		case ">":
			return lf > rf, nil
		default:
			return lf >= rf, nil
		}
	}
	return false, fmt.Errorf("unsupported operator %q", c.op)
}

func (v zzVal) values() []string {
	if v.IsList {
		return v.List
	}
	if v.Present {
		return []string{v.Str}
	}
	return nil
}

func (e *zzEval) expandList(items []zzLit, seen map[string]bool) (map[string]bool, error) {
	out := map[string]bool{}
	for _, it := range items {
		if !it.Quoted {
			if nested, ok := e.rs.lists[it.Text]; ok {
				if seen[it.Text] {
					return nil, fmt.Errorf("list cycle at %q", it.Text)
				}
				seen[it.Text] = true
				sub, err := e.expandList(nested, seen)
				delete(seen, it.Text)
				if err != nil {
					return nil, err
				}
				for k := range sub {
					out[k] = true
				}
				continue
			}
		}
		out[it.Text] = true
	}
	return out, nil
}

type zzOperand struct {
	kind   string // "word", "lit"
	name   string
	arg    string
	hasArg bool
}

func (e *zzEval) operand(o zzOperand) (zzVal, error) {
	if o.kind == "lit" {
		return zzSingle(o.name), nil
	}
	if _, ok := e.rs.macros[o.name]; ok && !o.hasArg {
		ok, err := e.macro(o.name)
		if err != nil {
			return zzVal{}, err
		}
		return zzSingle(strconv.FormatBool(ok)), nil
	}
	return e.field(o.name, o.arg, o.hasArg)
}

func (e *zzEval) field(name, arg string, hasArg bool) (zzVal, error) {
	if strings.HasPrefix(name, "jevt.") {
		return e.jevt(name, arg)
	}
	if _, ok := e.fields[name]; !ok {
		return zzVal{}, fmt.Errorf("field %q is not registered", name)
	}
	a := ""
	if hasArg {
		a = arg
	}
	v, present, err := zzExtract(e.plugin, e.fields, e.json, name, a)
	if err != nil {
		return zzVal{}, fmt.Errorf("extract %s: %w", name, err)
	}
	if !present {
		return zzVal{}, nil
	}
	strs, isList := zzStrings(v)
	if isList {
		return zzVal{Present: true, IsList: true, List: strs}, nil
	}
	if len(strs) == 1 {
		return zzSingle(strs[0]), nil
	}
	return zzSingle(fmt.Sprintf("%v", v)), nil
}

func (e *zzEval) jevt(name, arg string) (zzVal, error) {
	switch name {
	case "jevt.rawtime":
		return zzSingle("1700000000"), nil
	case "jevt.obj":
		return zzSingle(string(e.json.MarshalTo(nil))), nil
	case "jevt.value":
		if arg == "" {
			return zzVal{}, fmt.Errorf("jevt.value without a path")
		}
		v := e.json
		for _, seg := range strings.Split(strings.TrimPrefix(arg, "/"), "/") {
			if seg == "" {
				continue
			}
			if v == nil {
				return zzVal{}, nil
			}
			if v.Type() == fastjson.TypeArray {
				n, err := strconv.Atoi(seg)
				if err != nil {
					return zzVal{}, nil
				}
				arr := v.GetArray()
				if n < 0 || n >= len(arr) {
					return zzVal{}, nil
				}
				v = arr[n]
				continue
			}
			v = v.Get(seg)
		}
		if v == nil {
			return zzVal{}, nil
		}
		switch v.Type() {
		case fastjson.TypeString:
			return zzSingle(string(v.GetStringBytes())), nil
		case fastjson.TypeNumber, fastjson.TypeTrue, fastjson.TypeFalse:
			return zzSingle(string(v.MarshalTo(nil))), nil
		case fastjson.TypeArray:
			var out []string
			for _, it := range v.GetArray() {
				if it.Type() == fastjson.TypeString {
					out = append(out, string(it.GetStringBytes()))
				} else {
					out = append(out, string(it.MarshalTo(nil)))
				}
			}
			return zzVal{Present: true, IsList: true, List: out}, nil
		default:
			return zzSingle(string(v.MarshalTo(nil))), nil
		}
	}
	return zzVal{}, fmt.Errorf("unknown jevt field %q", name)
}

// ---------------------------------------------------------------- expression parser

type zzTokKind int

const (
	zzEOF zzTokKind = iota
	zzWord
	zzString
	zzNumber
	zzLParen
	zzRParen
	zzComma
	zzLBracket
	zzRBracket
	zzOp
)

type zzTok struct {
	kind zzTokKind
	text string
}

func zzLex(s string) []zzTok {
	var out []zzTok
	i := 0
	for i < len(s) {
		c := s[i]
		switch {
		case c == ' ' || c == '\t' || c == '\n' || c == '\r':
			i++
		case c == '(':
			out = append(out, zzTok{kind: zzLParen, text: "("})
			i++
		case c == ')':
			out = append(out, zzTok{kind: zzRParen, text: ")"})
			i++
		case c == ',':
			out = append(out, zzTok{kind: zzComma, text: ","})
			i++
		case c == '[':
			out = append(out, zzTok{kind: zzLBracket, text: "["})
			i++
		case c == ']':
			out = append(out, zzTok{kind: zzRBracket, text: "]"})
			i++
		case c == '"' || c == '\'':
			q := c
			j := i + 1
			for j < len(s) && s[j] != q {
				j++
			}
			if j >= len(s) {
				out = append(out, zzTok{kind: zzString, text: s[i+1:]})
				i = len(s)
			} else {
				out = append(out, zzTok{kind: zzString, text: s[i+1 : j]})
				i = j + 1
			}
		case c == '!' && i+1 < len(s) && s[i+1] == '=':
			out = append(out, zzTok{kind: zzOp, text: "!="})
			i += 2
		case c == '<' || c == '>':
			op := string(c)
			i++
			if i < len(s) && s[i] == '=' {
				op += "="
				i++
			}
			out = append(out, zzTok{kind: zzOp, text: op})
		case c == '=':
			i++
			if i < len(s) && s[i] == '=' {
				i++
			}
			out = append(out, zzTok{kind: zzOp, text: "="})
		default:
			j := i
			for j < len(s) {
				d := s[j]
				if d == ' ' || d == '\t' || d == '\n' || d == '\r' ||
					d == '(' || d == ')' || d == ',' || d == '[' || d == ']' ||
					d == '=' || d == '!' || d == '<' || d == '>' {
					break
				}
				j++
			}
			word := s[i:j]
			kind := zzWord
			if _, err := strconv.ParseFloat(word, 64); err == nil && !strings.ContainsAny(word, "abcdfghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_") {
				kind = zzNumber
			}
			out = append(out, zzTok{kind: kind, text: word})
			i = j
		}
	}
	out = append(out, zzTok{kind: zzEOF})
	return out
}

type zzNode interface{}

type zzOr struct{ parts []zzNode }
type zzAnd struct{ parts []zzNode }
type zzNot struct{ x zzNode }
type zzBare struct{ name string }
type zzCmp struct {
	left  zzOperand
	op    string
	right zzOperand
	list  []zzLit
}

type zzParser struct {
	lex []zzTok
	pos int
}

func (p *zzParser) peek() zzTok { return p.lex[p.pos] }
func (p *zzParser) next() zzTok {
	t := p.lex[p.pos]
	if t.kind != zzEOF {
		p.pos++
	}
	return t
}
func (p *zzParser) acceptWord(w string) bool {
	if p.peek().kind == zzWord && strings.EqualFold(p.peek().text, w) {
		p.pos++
		return true
	}
	return false
}

func (p *zzParser) parseExpr() (zzNode, error) { return p.parseOr() }

func (p *zzParser) parseOr() (zzNode, error) {
	first, err := p.parseAnd()
	if err != nil {
		return nil, err
	}
	parts := []zzNode{first}
	for p.acceptWord("or") {
		n, err := p.parseAnd()
		if err != nil {
			return nil, err
		}
		parts = append(parts, n)
	}
	if len(parts) == 1 {
		return parts[0], nil
	}
	return zzOr{parts: parts}, nil
}

func (p *zzParser) parseAnd() (zzNode, error) {
	first, err := p.parseUnary()
	if err != nil {
		return nil, err
	}
	parts := []zzNode{first}
	for p.acceptWord("and") {
		n, err := p.parseUnary()
		if err != nil {
			return nil, err
		}
		parts = append(parts, n)
	}
	if len(parts) == 1 {
		return parts[0], nil
	}
	return zzAnd{parts: parts}, nil
}

func (p *zzParser) parseUnary() (zzNode, error) {
	if p.acceptWord("not") {
		x, err := p.parseUnary()
		if err != nil {
			return nil, err
		}
		return zzNot{x: x}, nil
	}
	if p.peek().kind == zzLParen {
		p.next()
		x, err := p.parseExpr()
		if err != nil {
			return nil, err
		}
		if p.peek().kind != zzRParen {
			return nil, fmt.Errorf("expected )")
		}
		p.next()
		return x, nil
	}
	return p.parseCompare()
}

func (p *zzParser) parseCompare() (zzNode, error) {
	left, err := p.parseOperand()
	if err != nil {
		return nil, err
	}
	t := p.peek()
	if t.kind == zzWord {
		switch strings.ToLower(t.text) {
		case "exists", "nexists":
			p.next()
			return zzCmp{left: left, op: strings.ToLower(t.text)}, nil
		case "in", "intersects":
			p.next()
			if p.peek().kind != zzLParen {
				return nil, fmt.Errorf("expected ( after %s", t.text)
			}
			p.next()
			var items []zzLit
			for p.peek().kind != zzRParen {
				it := p.next()
				if it.kind != zzWord && it.kind != zzString && it.kind != zzNumber {
					return nil, fmt.Errorf("unexpected list item %q", it.text)
				}
				items = append(items, zzLit{Text: it.text, Quoted: it.kind == zzString})
				if p.peek().kind == zzComma {
					p.next()
					continue
				}
				break
			}
			if p.peek().kind != zzRParen {
				return nil, fmt.Errorf("expected ) after %s list", t.text)
			}
			p.next()
			return zzCmp{left: left, op: strings.ToLower(t.text), list: items}, nil
		case "startswith", "endswith", "contains":
			p.next()
			right, err := p.parseRightOperand()
			if err != nil {
				return nil, err
			}
			return zzCmp{left: left, op: strings.ToLower(t.text), right: right}, nil
		}
	}
	if t.kind == zzOp {
		p.next()
		right, err := p.parseRightOperand()
		if err != nil {
			return nil, err
		}
		return zzCmp{left: left, op: t.text, right: right}, nil
	}
	if left.kind == "word" && !left.hasArg {
		return zzBare{name: left.name}, nil
	}
	return nil, fmt.Errorf("unsupported expression near %q", t.text)
}

func (p *zzParser) parseRightOperand() (zzOperand, error) {
	op, err := p.parseOperand()
	if err != nil {
		return op, err
	}
	if op.kind == "word" && !op.hasArg {
		return zzOperand{kind: "lit", name: op.name}, nil
	}
	return op, nil
}

func (p *zzParser) parseOperand() (zzOperand, error) {
	t := p.peek()
	switch t.kind {
	case zzString, zzNumber:
		p.next()
		return zzOperand{kind: "lit", name: t.text}, nil
	case zzWord:
		p.next()
		op := zzOperand{kind: "word", name: t.text}
		if p.peek().kind == zzLBracket {
			p.next()
			a := p.next()
			if a.kind != zzWord && a.kind != zzString && a.kind != zzNumber {
				return zzOperand{}, fmt.Errorf("bad field argument %q", a.text)
			}
			op.arg, op.hasArg = a.text, true
			if p.peek().kind != zzRBracket {
				return zzOperand{}, fmt.Errorf("expected ]")
			}
			p.next()
		}
		return op, nil
	}
	return zzOperand{}, fmt.Errorf("expected operand, got %q", t.text)
}

// zzAssertNotReported is the negative control: a request that only differs from its benign twin
// by a setting that must stay allowed must not make any additional shipped rule fire.
func zzAssertNotReported(t *testing.T, rulesPath, what, event, benign string) {
	t.Helper()
	rs := zzLoadRules(t, rulesPath)
	a, aErr := zzFired(t, rs, event)
	b, bErr := zzFired(t, rs, benign)
	var diff []string
	for name := range a {
		if !b[name] {
			diff = append(diff, name)
		}
	}
	if len(diff) > 0 {
		t.Fatalf("%s: the shipped rule set reports this request but must not (%v); rule evaluation problems: event=%v benign=%v", what, diff, aErr, bErr)
	}
}

// zzAssertNoAlertMentioning fails when any shipped rule whose description or output mentions the
// given product term fires for an event that must stay quiet. It catches an over-broad change that
// reports every request rather than the one that carries the setting.
func zzAssertNoAlertMentioning(t *testing.T, rulesPath, what, event, term string) {
	t.Helper()
	rs := zzLoadRules(t, rulesPath)
	fired, errs := zzFired(t, rs, event)
	byName := map[string]zzRule{}
	for _, r := range rs.rules {
		byName[r.Name] = r
	}
	term = strings.ToLower(term)
	for name := range fired {
		r := byName[name]
		text := strings.ToLower(r.Desc + " " + r.Output)
		if strings.Contains(text, term) {
			t.Fatalf("%s: the shipped rule %q reports this request but must not (its description mentions %q)", what, name, term)
		}
	}
	_ = errs
}
