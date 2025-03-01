#!/usr/bin/env python3
import os
import sys
import base64
import json
import random
import string
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse
from PIL import Image, ImageDraw, ImageFont
import io

# Default values
HOST = "localhost"
PORT = 8000
UPLOAD_DIR = "uploads"
BASE_URL = f"http://{HOST}:{PORT}"

# Parse command line arguments
if len(sys.argv) > 1:
    UPLOAD_DIR = sys.argv[1]
    
if len(sys.argv) > 2:
    if sys.argv[2].startswith("-H"):
        # Handle -H"http://localhost:8000" format
        BASE_URL = sys.argv[2][2:].strip('"')
    else:
        # Handle localhost:8000 format
        parts = sys.argv[2].split(":")
        if len(parts) > 1:
            HOST = parts[0]
            try:
                PORT = int(parts[1])
            except ValueError:
                print(f"Warning: Invalid port number '{parts[1]}', using default port 8000")

# Create upload directory if it doesn't exist
os.makedirs(UPLOAD_DIR, exist_ok=True)

def add_watermark(image_data):

    try:
        # Open the image from binary data
        img = Image.open(io.BytesIO(image_data))
        
        # Open the watermark and social media images
        base_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public")
        watermark = Image.open(os.path.join(base_path, "logo.png")).convert("RGBA")
        insta_icon = Image.open(os.path.join(base_path, "insta.jpg")).convert("RGBA")
        link_icon = Image.open(os.path.join(base_path, "link.png")).convert("RGBA")
        
        # Resize watermark (20% of image width)
        watermark_width = int(img.width * 0.20)
        watermark_height = int(watermark.height * (watermark_width / watermark.width))
        watermark = watermark.resize((watermark_width, watermark_height))
        
        # Resize Instagram icon (5% of image height)
        insta_height = int(img.height * 0.05)
        insta_width = int(insta_icon.width * (insta_height / insta_icon.height))
        insta_icon = insta_icon.resize((insta_width, insta_height))
        
        # Resize LinkedIn icon (6% of image height)
        link_height = int(img.height * 0.06)
        link_width = int(link_icon.width * (link_height / link_icon.height))
        link_icon = link_icon.resize((link_width, link_height))
        
        # Create a new transparent image
        transparent = Image.new('RGBA', img.size, (0,0,0,0))
        
        # Calculate positions
        watermark_pos = (img.width - watermark_width - 20, 20)  # Top right
        insta_pos = (0, img.height - insta_height)  # Bottom left
        link_pos = (img.width - link_width , img.height - link_height)  # Bottom right
        
        # Paste all images
        transparent.paste(watermark, watermark_pos, watermark)
        transparent.paste(insta_icon, insta_pos, insta_icon)
        transparent.paste(link_icon, link_pos, link_icon)
        
        # Convert the original image to RGBA if needed
        if img.mode != 'RGBA':
            img = img.convert('RGBA')
        
        # Combine the images
        watermarked = Image.alpha_composite(img, transparent)
        
        # Convert back to RGB for JPEG
        watermarked = watermarked.convert('RGB')
        
        # Save to bytes
        output = io.BytesIO()
        watermarked.save(output, format='JPEG', quality=100)
        return output.getvalue()
    except Exception as e:
        print(f"Error adding watermark and icons: {e}")
        return image_data

class FileServer(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def do_GET(self):
        parsed_url = urlparse(self.path)
        
        # Serve files from upload directory
        if parsed_url.path.startswith('/uploads/'):
            file_path = os.path.join(UPLOAD_DIR, os.path.basename(parsed_url.path))
            if os.path.exists(file_path):
                self.send_response(200)
                if file_path.endswith('.jpg') or file_path.endswith('.jpeg'):
                    self.send_header('Content-type', 'image/jpeg')
                elif file_path.endswith('.png'):
                    self.send_header('Content-type', 'image/png')
                else:
                    self.send_header('Content-type', 'application/octet-stream')
                self.end_headers()
                with open(file_path, 'rb') as file:
                    self.wfile.write(file.read())
            else:
                self.send_response(404)
                self.end_headers()
                self.wfile.write(b'File not found')
        
        # List all files in the upload directory
        elif parsed_url.path == '/list':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            files = []
            for filename in os.listdir(UPLOAD_DIR):
                if filename.endswith('.jpg') or filename.endswith('.jpeg') or filename.endswith('.png'):
                    file_url = f"{BASE_URL}/uploads/{filename}"
                    files.append({"url": file_url, "filename": filename})
            
            self.wfile.write(json.dumps({"files": files}).encode())
        
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'Not found')
    
    def do_POST(self):
        if self.path == '/upload':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode('utf-8'))
                
                # Support both new and old formats
                image_data = data.get('image')
                
                if image_data:
                    # Process the image in the original format
                    if image_data.startswith('data:image'):
                        image_data = image_data.split(',')[1]
                    
                    # Decode base64 data
                    image_bytes = base64.b64decode(image_data)
                    
                    # Add watermark
                    watermarked_image = add_watermark(image_bytes)
                    
                    # Generate a random filename
                    random_str = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
                    filename = f"image_{random_str}.jpg"
                    file_path = os.path.join(UPLOAD_DIR, filename)
                    
                    # Save the image
                    with open(file_path, 'wb') as f:
                        f.write(watermarked_image)
                    
                    # Return the URL to the saved image
                    image_url = f"{BASE_URL}/uploads/{filename}"
                    
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(json.dumps({"url": image_url}).encode())
                    return
                else:
                    self.send_response(400)
                    self.send_header('Content-type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": "No image data provided"}).encode())
            
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode())
        elif self.path == '/upload-original':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode('utf-8'))
                image_data = data.get('image')
                
                if image_data:
                    # Remove data URI prefix if present
                    if image_data.startswith('data:image'):
                        image_data = image_data.split(',')[1]
                    
                    # Decode base64 data
                    image_bytes = base64.b64decode(image_data)
                    
                    # Generate a random filename
                    random_str = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
                    filename = f"original_{random_str}.jpg"
                    file_path = os.path.join(UPLOAD_DIR, filename)
                    
                    # Save the image without watermark
                    with open(file_path, 'wb') as f:
                        f.write(image_bytes)
                    
                    # Return the URL to the saved image
                    image_url = f"{BASE_URL}/uploads/{filename}"
                    
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(json.dumps({"url": image_url}).encode())
                else:
                    self.send_response(400)
                    self.send_header('Content-type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": "No image data provided"}).encode())
            
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode())
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'Not found')

if __name__ == "__main__":
    server = HTTPServer((HOST, PORT), FileServer)
    print(f"Server started at {BASE_URL}")
    print(f"Saving files to {os.path.abspath(UPLOAD_DIR)}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    server.server_close()
    print("Server stopped")