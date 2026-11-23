// Code Lab portable — 사이트 전체를 exe 하나에 담는다.
// 인터넷 없이 더블클릭 한 번으로 브라우저가 열린다 (sense-lab · teach-lab 과 같은 방식).
//
// localhost 는 보안 출처라 서비스 워커가 동작한다 → input() · 오프라인 캐시도 그대로 된다.
package main

import (
	"embed"
	"fmt"
	"io/fs"
	"mime"
	"net"
	"net/http"
	"os/exec"
	"time"
)

//go:embed all:site
var siteFS embed.FS

// 자매 서비스 exe 와 같이 켜도 부딪히지 않게 포트 대역을 따로 쓴다
const basePort = 50070

func main() {
	// 파이썬(Pyodide) 파일의 MIME 을 명시 등록한다.
	// .wasm 이 틀리면 스트리밍 컴파일이 실패한다.
	mime.AddExtensionType(".wasm", "application/wasm")
	mime.AddExtensionType(".mjs", "text/javascript; charset=utf-8")
	mime.AddExtensionType(".js", "text/javascript; charset=utf-8")
	mime.AddExtensionType(".py", "text/plain; charset=utf-8")
	mime.AddExtensionType(".webmanifest", "application/manifest+json")
	mime.AddExtensionType(".task", "application/octet-stream")
	mime.AddExtensionType(".tflite", "application/octet-stream")
	mime.AddExtensionType(".otf", "font/otf")

	sub, _ := fs.Sub(siteFS, "site")

	port := basePort
	var ln net.Listener
	var err error
	for i := 0; i < 10; i++ {
		ln, err = net.Listen("tcp", fmt.Sprintf("localhost:%d", port))
		if err == nil {
			break
		}
		port++
	}
	if ln == nil {
		fmt.Println("no free port found near", basePort)
		fmt.Scanln()
		return
	}

	url := fmt.Sprintf("http://localhost:%d", port)
	fmt.Println("Code Lab -", url)
	fmt.Println("Close this window to stop.")

	go func() {
		time.Sleep(600 * time.Millisecond)
		exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
	}()

	http.Serve(ln, http.FileServer(http.FS(sub)))
}
