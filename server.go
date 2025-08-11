package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
)

func main() {
	// Get the current directory
	dir, err := os.Getwd()
	if err != nil {
		log.Fatal(err)
	}

	// Create a file server for static files
	fs := http.FileServer(http.Dir(dir))

	// Wrap the file server with CORS headers
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// Add CORS headers
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		// Handle preflight requests
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		// Set content type based on file extension
		path := r.URL.Path
		if path == "/" {
			path = "/index.html"
		}

		ext := filepath.Ext(path)
		switch ext {
		case ".html":
			w.Header().Set("Content-Type", "text/html")
		case ".js":
			w.Header().Set("Content-Type", "application/javascript")
		case ".css":
			w.Header().Set("Content-Type", "text/css")
		case ".json":
			w.Header().Set("Content-Type", "application/json")
		}

		// Serve the file
		fs.ServeHTTP(w, r)
	})

	port := "8080"
	if envPort := os.Getenv("PORT"); envPort != "" {
		port = envPort
	}

	fmt.Printf("🎯 sqncesbot server starting...\n")
	fmt.Printf("📍 Server running at: http://localhost:%s\n", port)
	fmt.Printf("🎮 Open http://localhost:%s in your browser to play\n", port)
	fmt.Printf("📊 JSON files will be served with proper CORS headers\n")
	fmt.Printf("🛑 Press Ctrl+C to stop the server\n\n")

	log.Fatal(http.ListenAndServe(":"+port, nil))
}