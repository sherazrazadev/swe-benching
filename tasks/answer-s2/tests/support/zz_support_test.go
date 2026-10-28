package export_test

import (
	"context"
	"encoding/json"
	"html"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"github.com/apache/answer/internal/base/constant"
	"github.com/apache/answer/internal/base/translator"
	"github.com/apache/answer/internal/entity"
	"github.com/apache/answer/internal/schema"
	"github.com/apache/answer/internal/service/export"
	"github.com/apache/answer/internal/service/siteinfo_common"
)

const (
	testSiteURL   = "https://example.test"
	testPermalink = 1
	testQID       = "1"
	testAID       = "4"
	testCID       = "7"
)

var (
	// Elements that can execute script or pull in remote content. The three
	// notification bodies only ever contain a, br, blockquote, small and strong.
	liveElement = regexp.MustCompile(`(?is)<\s*(script|img|svg|iframe|object|embed|math|video|audio|form|input|style|link|meta|base|template|frame|frameset|applet)\b`)
	// An inline event-handler attribute on any element.
	eventAttr = regexp.MustCompile(`(?is)<\s*[a-z][^>]*\son[a-z]+\s*=`)
	// A script URL in a link or frame source.
	jsURL = regexp.MustCompile(`(?is)(href|src)\s*=\s*['"]?\s*javascript:`)
)

func TestMain(m *testing.M) {
	dir := findI18nDir()
	if dir == "" {
		panic("i18n bundle directory not found")
	}
	if _, err := translator.NewTranslator(&translator.I18n{BundleDir: dir}); err != nil {
		panic(err)
	}
	os.Exit(m.Run())
}

func findI18nDir() string {
	dir, _ := os.Getwd()
	for i := 0; i < 10; i++ {
		candidate := filepath.Join(dir, "i18n")
		if _, err := os.Stat(filepath.Join(candidate, "en_US.yaml")); err == nil {
			return candidate
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	return ""
}

// stubSiteInfo serves the two site settings reads that notification rendering
// needs. It is a test double, not the object under test.
type stubSiteInfo struct {
	siteinfo_common.SiteInfoCommonService
	name      string
	siteURL   string
	permalink int
}

func (s *stubSiteInfo) GetSiteGeneral(ctx context.Context) (*schema.SiteGeneralResp, error) {
	return &schema.SiteGeneralResp{Name: s.name, SiteUrl: s.siteURL}, nil
}

func (s *stubSiteInfo) GetSiteSeo(ctx context.Context) (*schema.SiteSeoResp, error) {
	return &schema.SiteSeoResp{Permalink: s.permalink}, nil
}

func defaultSite() *stubSiteInfo {
	return &stubSiteInfo{name: "Example Community", siteURL: testSiteURL, permalink: testPermalink}
}

func newMailer(site siteinfo_common.SiteInfoCommonService) *export.EmailService {
	return export.NewEmailService(nil, nil, site)
}

// storedSiteRepo serves a site-settings document as the product's settings
// layer stores it, so a value travels the same read path as in production.
type storedSiteRepo struct{ content string }

func (r *storedSiteRepo) SaveByType(ctx context.Context, siteType string, data *entity.SiteInfo) error {
	return nil
}

func (r *storedSiteRepo) GetByType(ctx context.Context, siteType string, withoutCache ...bool) (*entity.SiteInfo, bool, error) {
	if siteType == constant.SiteTypeGeneral {
		return &entity.SiteInfo{Type: siteType, Content: r.content}, true, nil
	}
	return nil, false, nil
}

func (r *storedSiteRepo) IsBrandingFileUsed(ctx context.Context, filePath string) (bool, error) {
	return false, nil
}

// storedSite builds the settings service over a stored document whose site name
// is the given value.
func storedSite(name string) siteinfo_common.SiteInfoCommonService {
	content, _ := json.Marshal(map[string]string{
		"name":             name,
		"short_description": "a community",
		"description":      "a community",
		"site_url":         testSiteURL,
		"contact_email":    "hello@example.test",
	})
	return siteinfo_common.NewSiteInfoCommonService(&storedSiteRepo{content: string(content)})
}

// assertNoLiveMarkup fails when a supplied value has become active markup in the
// rendered body: a live element, an inline event handler, a script URL, or the
// payload text surviving verbatim.
func assertNoLiveMarkup(t *testing.T, where, body string, payloads ...string) {
	t.Helper()
	if m := liveElement.FindString(body); m != "" {
		t.Fatalf("%s: rendered body contains a live element (%q); body=%q", where, m, body)
	}
	if m := eventAttr.FindString(body); m != "" {
		t.Fatalf("%s: rendered body contains an inline event handler (%q); body=%q", where, m, body)
	}
	if m := jsURL.FindString(body); m != "" {
		t.Fatalf("%s: rendered body contains a script URL (%q); body=%q", where, m, body)
	}
	low := strings.ToLower(body)
	for _, p := range payloads {
		if p != "" && strings.Contains(low, strings.ToLower(p)) {
			t.Fatalf("%s: supplied value survived as live markup (%q); body=%q", where, p, body)
		}
	}
}

// assertBodyKeeps fails when the email's own structure or a generated link is gone.
func assertBodyKeeps(t *testing.T, where, body string, want ...string) {
	t.Helper()
	for _, w := range want {
		if !strings.Contains(body, w) {
			t.Fatalf("%s: rendered body lost %q; body=%q", where, w, body)
		}
	}
}

// decoded returns the body with one level of character references resolved, the
// way a mail client shows it. It is used only to check that legitimate text is
// still readable; it computes no expected value.
func decoded(body string) string { return html.UnescapeString(body) }

func mustContain(t *testing.T, where, text string, want ...string) {
	t.Helper()
	for _, w := range want {
		if !strings.Contains(text, w) {
			t.Fatalf("%s: missing %q; got %q", where, w, text)
		}
	}
}

func contains(haystack, needle string) bool { return strings.Contains(haystack, needle) }
