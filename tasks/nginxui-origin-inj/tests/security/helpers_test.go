package zzhtests

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/0xJacky/Nginx-UI/internal/cache"
	"github.com/0xJacky/Nginx-UI/internal/middleware"
	"github.com/0xJacky/Nginx-UI/internal/passkey"
	coremodel "github.com/0xJacky/Nginx-UI/model"
	corequery "github.com/0xJacky/Nginx-UI/query"
	"github.com/0xJacky/Nginx-UI/router"
	cfgsettings "github.com/0xJacky/Nginx-UI/settings"
	"github.com/gin-gonic/gin"
	cosyRouter "github.com/uozi-tech/cosy/router"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func setupState(t *testing.T) {
	t.Helper()
	cache.InitInMemoryCache()
	dbName := strings.ReplaceAll(t.Name(), "/", "_")
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:%s?mode=memory&cache=shared", dbName)), &gorm.Config{})
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	if err := db.AutoMigrate(&coremodel.User{}, &coremodel.AuthToken{}, &coremodel.Passkey{}, &coremodel.Node{}, &coremodel.BanIP{}); err != nil {
		t.Fatalf("migrate database: %v", err)
	}
	coremodel.Use(db)
	corequery.Use(db)
	corequery.SetDefault(db)
	t.Cleanup(func() {
		cache.Shutdown()
		coremodel.Use(nil)
	})
}

// productEngine starts the application the same way the server does and hands back
// the engine it serves requests on.
func productEngine(t *testing.T) *gin.Engine {
	t.Helper()
	setupState(t)
	cosyRouter.Init()
	router.InitRouter()
	return cosyRouter.GetEngine()
}

func setTopology(t *testing.T, official, bundledDisabled bool) {
	t.Helper()
	if official {
		t.Setenv("NGINX_UI_OFFICIAL_DOCKER", "true")
	} else {
		t.Setenv("NGINX_UI_OFFICIAL_DOCKER", "false")
	}
	if bundledDisabled {
		t.Setenv("NGINX_UI_DISABLE_BUNDLED_NGINX", "true")
	} else {
		t.Setenv("NGINX_UI_DISABLE_BUNDLED_NGINX", "false")
	}
}

func withAllowlist(t *testing.T, list []string) {
	t.Helper()
	original := cfgsettings.AuthSettings.IPWhiteList
	t.Cleanup(func() { cfgsettings.AuthSettings.IPWhiteList = original })
	cfgsettings.AuthSettings.IPWhiteList = list
}

func withMaxAttempts(t *testing.T, n int) {
	t.Helper()
	original := cfgsettings.AuthSettings.MaxAttempts
	t.Cleanup(func() { cfgsettings.AuthSettings.MaxAttempts = original })
	cfgsettings.AuthSettings.MaxAttempts = n
}

func newRequest(method, path, body string) *http.Request {
	var reader *strings.Reader
	if body != "" {
		reader = strings.NewReader(body)
	}
	req := httptest.NewRequest(method, path, nil)
	if reader != nil {
		req = httptest.NewRequest(method, path, reader)
		req.Header.Set("Content-Type", "application/json")
	}
	return req
}

func serve(engine *gin.Engine, req *http.Request) *httptest.ResponseRecorder {
	recorder := httptest.NewRecorder()
	engine.ServeHTTP(recorder, req)
	return recorder
}

func ipWhiteListEngine() *gin.Engine {
	engine := gin.New()
	engine.Use(middleware.IPWhiteList())
	engine.GET("/probe", func(c *gin.Context) { c.Status(http.StatusNoContent) })
	return engine
}

func apiGet(engine *gin.Engine, path, remote, forwardedFor, realIP string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, path, nil)
	req.RemoteAddr = remote
	if forwardedFor != "" {
		req.Header.Set("X-Forwarded-For", forwardedFor)
	}
	if realIP != "" {
		req.Header.Set("X-Real-IP", realIP)
	}
	return serve(engine, req)
}

func enablePasskey(t *testing.T) {
	t.Helper()
	original := *cfgsettings.WebAuthnSettings
	t.Cleanup(func() { *cfgsettings.WebAuthnSettings = original })
	cfgsettings.WebAuthnSettings.RPDisplayName = "Nginx UI Test"
	cfgsettings.WebAuthnSettings.RPID = "localhost"
	cfgsettings.WebAuthnSettings.RPOrigins = []string{"http://localhost:9000"}
	passkey.Init(context.Background())
}

func passkeyAttempt(engine *gin.Engine, remote, forwardedFor string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/api/finish_passkey_pre_auth", strings.NewReader("{}"))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Passkey-Pre-Auth-ID", "no-such-session")
	req.RemoteAddr = remote
	if forwardedFor != "" {
		req.Header.Set("X-Forwarded-For", forwardedFor)
	}
	return serve(engine, req)
}
