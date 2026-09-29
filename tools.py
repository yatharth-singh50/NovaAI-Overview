from ddgs import DDGS
from datetime import datetime
import requests
from bs4 import BeautifulSoup
import json
import psutil
import GPUtil
import os
import urllib.parse
import webbrowser
import pyautogui
import time
import subprocess

def search_the_web(query: str) -> str:
    print(f"\n[Nova: Searching → '{query}']")
    try:
        results = DDGS().text(query, max_results=5)
        if not results:
            return json.dumps({"error": "No results found.", "results": []})
        structured = [{"index": i, "title": res.get("title", "Untitled"), "url": res.get("href", ""), "snippet": res.get("body", "")} for i, res in enumerate(results, start=1)]
        return json.dumps({"query": query, "results": structured, "instruction": "Cite sources inline using markdown link syntax: [Source Title](URL)."})
    except Exception as e:
        return json.dumps({"error": f"Search failed: {str(e)}", "results": []})

def save_to_memory(information: str) -> str:
    """
    Saves a permanent fact or user preference. 
    CRITICAL: 'information' MUST be a complete, detailed sentence with context (e.g., 'The user has a meeting on Tuesday, Oct 5th at 3 PM' instead of 'meeting tuesday').
    """
    try:
        with open("memory.txt", "a", encoding="utf-8") as f:
            f.write(f"\n- {information}")
        return f"Successfully saved to memory: {information}"
    except Exception as e:
        return f"Error saving to memory: {str(e)}"
    
def run_terminal_command(command: str) -> str:
    print(f"\n[Nova Actuator: Running Command -> '{command}']")
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True, timeout=15)
        if result.returncode == 0:
            output = result.stdout.strip()
            return json.dumps({"status": "success", "output": output[:500] if output else "Command executed successfully."})
        else:
            return json.dumps({"error": result.stderr.strip()[:500]})
    except Exception as e:
        return json.dumps({"error": str(e)})

def type_in_notepad(text: str) -> str:
    """Opens Notepad and physically types the provided text into it."""
    print("\n[Nova Actuator: Opening Notepad and injecting text...]")
    try:
        os.system('start notepad')
        time.sleep(2.0) 
        subprocess.run("clip", text=True, input=text)
        time.sleep(0.3)
        pyautogui.hotkey('ctrl', 'v')
        return json.dumps({"status": "success", "message": "Successfully injected text into Notepad."})
    except Exception as e:
        return json.dumps({"error": f"Failed to type in notepad: {str(e)}"})

# --- NEW DEDICATED SPOTIFY TOOL ---
def play_spotify(song_name: str) -> str:
    """Opens Spotify and plays the specified song or artist."""
    print(f"\n[Nova Actuator: Playing '{song_name}' on Spotify]")
    try:
        query = urllib.parse.quote(song_name)
        os.system(f"start spotify:search:{query}")
        print("[Nova Actuator: Waiting for UI to render...]")
        for attempt in range(10):
            time.sleep(1)
            try:
                button_cords = pyautogui.locateCenterOnScreen('templates/spotify_play.png', confidence=0.8)
                if button_cords:
                    pyautogui.moveTo(button_cords.x, button_cords.y, duration=0.2)
                    pyautogui.click()
                    return json.dumps({"status": "success", "message": f"Successfully clicked play for {song_name}."})
            except Exception:
                pass
        return json.dumps({"error": "Could not locate the Play button on screen."})
    except Exception as e:
        return json.dumps({"error": f"Spotify failed: {str(e)}"})

# --- NEW DEDICATED DISCORD TOOL ---
def message_discord(username: str, message: str = "") -> str:
    """Opens Discord and sends a message to the specified username."""
    print(f"\n[Nova Actuator: Messaging '{username}' on Discord]")
    try:
        all_discord_windows = pyautogui.getWindowsWithTitle('Discord')
        discord_windows = [win for win in all_discord_windows if win.title.strip() == 'Discord' or win.title.strip().endswith(' - Discord')]
        if discord_windows:
            win = discord_windows[0]
            if win.isMinimized: win.restore()
            win.activate()
            time.sleep(1.0)
        else:
            os.system("start discord:")
            time.sleep(5.0)
        
        pyautogui.hotkey('ctrl', 'k')
        time.sleep(0.8) 
        subprocess.run("clip", text=True, input=username)
        time.sleep(0.2)
        pyautogui.hotkey('ctrl', 'v')
        time.sleep(1.2) 
        pyautogui.press('enter')
        time.sleep(1.0) 
        
        if message and message.strip():
            subprocess.run("clip", text=True, input=message)
            time.sleep(0.2)
            pyautogui.hotkey('ctrl', 'v')
            time.sleep(0.2)
            pyautogui.press('enter')
            return json.dumps({"status": "success", "message": f"Successfully messaged {username} on Discord."})
        else:
            return json.dumps({"status": "success", "message": f"Successfully opened DMs with {username}."})
    except Exception as e:
        return json.dumps({"error": f"Discord failed: {str(e)}"})

def dispatch_gmail(to_email: str, subject: str, body: str, chrome_profile: str = "") -> str:
    """Physically opens Chrome, drafts, and sends the email in one continuous action."""
    body = body.replace("[[CONFIRM_SEND]]", "").replace("[[CONFIRM_SEND]]\n", "").strip()
    print(f"\n[Nova Actuator: Dispatching Gmail to '{to_email}']")
    try:
        if chrome_profile:
            os.system(f'start chrome "https://mail.google.com" --profile-directory="{chrome_profile}"')
        else:
            os.system('start chrome "https://mail.google.com"')
            
        time.sleep(5.0) 
        button_cords = None
        for attempt in range(15):
            time.sleep(1)
            try:
                button_cords = pyautogui.locateCenterOnScreen('templates/gmail_compose.png', confidence=0.8)
                if button_cords: break
            except Exception: pass
                
        if not button_cords:
            return json.dumps({"error": "Could not visually locate the Gmail Compose button."})
            
        pyautogui.moveTo(button_cords.x, button_cords.y, duration=0.2)
        pyautogui.click()
        time.sleep(2.5) 
        
        # Paste To, Subject, and Body
        subprocess.run("clip", text=True, input=to_email)
        time.sleep(0.2); pyautogui.hotkey('ctrl', 'v'); time.sleep(0.5); pyautogui.press('enter'); time.sleep(0.5); pyautogui.press('tab') 
        subprocess.run("clip", text=True, input=subject)
        time.sleep(0.2); pyautogui.hotkey('ctrl', 'v'); time.sleep(0.5); pyautogui.press('tab') 
        subprocess.run("clip", text=True, input=body)
        time.sleep(0.2); pyautogui.hotkey('ctrl', 'v'); time.sleep(1.0)
        
        # Click Send (or fallback to keyboard shortcut)
        try:
            send_cords = pyautogui.locateCenterOnScreen('templates/gmail_send.png', confidence=0.8)
            if send_cords:
                pyautogui.moveTo(send_cords.x, send_cords.y, duration=0.2)
                pyautogui.click()
            else:
                pyautogui.hotkey('ctrl', 'enter')
        except Exception:
            pyautogui.hotkey('ctrl', 'enter')
            
        return json.dumps({"status": "success", "message": "Email composed and dispatched successfully."})
    except Exception as e:
        return json.dumps({"error": f"Failed to dispatch email: {str(e)}"})
    
# execute_os_action is now strictly for the browser and generic apps
def execute_os_action(action: str, target: str, payload: str = "") -> str:
    """
    Executes generic OS actions.
    Valid actions ONLY:
    - 'search_browser': target=search query.
    - 'open_app': target='chrome', payload=Profile name.
    """
    print(f"\n[Nova Actuator: {action} | Target: '{target}']")
    try:
        if action == 'search_browser':
            query = urllib.parse.quote(target)
            webbrowser.open(f"https://www.google.com/search?q={query}")
            return json.dumps({"status": "success", "message": f"Searched browser for {target}."})
        elif action == 'open_app':
            app_name = target.lower()
            if 'chrome' in app_name:
                profile = payload if payload else "Default"
                cmd = f'start chrome --profile-directory="{profile}"'
                os.system(cmd)
                return json.dumps({"status": "success", "message": f"Launched Chrome with {profile}."})
            else:
                os.system(f'start {app_name}')
                return json.dumps({"status": "success", "message": f"Attempted to launch {app_name}."})
        else:
            return json.dumps({"error": "Unknown OS action."})
    except Exception as e:
        return json.dumps({"error": f"Actuator failed: {str(e)}"})

def scrape_webpage(url: str) -> str:
    print(f"\n[Nova: Reading page → '{url}']")
    try:
        headers = {"User-Agent": "Mozilla/5.0"}
        response = requests.get(url, headers=headers, timeout=8)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")
        for tag in soup(["nav", "header", "footer", "script", "style", "aside"]): tag.decompose()
        article = soup.find("article")
        paragraphs = article.find_all(["p", "h2", "h3"]) if article else soup.find_all(["p", "h2", "h3"])
        text = " ".join(p.get_text(separator=" ").strip() for p in paragraphs if len(p.get_text().strip()) > 30)
        return json.dumps({"url": url, "content": text[:4000] if len(text) > 4000 else text or "No readable content.", "instruction": f"Cite this source: {url}"})
    except Exception as e:
        return json.dumps({"url": url, "error": f"Failed to read page: {str(e)}"})

def check_system_status() -> str:
    now = datetime.now()
    return json.dumps({"timestamp": now.isoformat(), "readable": now.strftime("%A, %B %d, %Y at %I:%M %p")})

def search_images(query: str) -> str:
    try:
        results = DDGS().images(query, max_results=1)
        if results:
            url = results[0].get("image")
            return json.dumps({"image_url": url, "instruction": f"Embed this image exactly like this: ![Visual representation]({url})"})
        return json.dumps({"error": "No relevant image found."})
    except Exception as e:
        return json.dumps({"error": f"Image search failed: {str(e)}"})

def search_news(query: str) -> str:
    try:
        results = DDGS().news(query, max_results=5)
        if not results:
            return json.dumps({"error": "No recent news found.", "results": []})
        structured = [{"title": r.get("title", "Untitled"), "date": r.get("date", "Unknown Date"), "url": r.get("url", ""), "snippet": r.get("body", "")} for r in results]
        return json.dumps({"query": query, "news_results": structured, "instruction": "Cite these news articles inline."})
    except Exception as e:
        return json.dumps({"error": f"News search failed: {str(e)}"})
    
def get_system_telemetry() -> str:
    try:
        cpu_usage = psutil.cpu_percent(interval=0.5)
        ram = psutil.virtual_memory()
        battery = psutil.sensors_battery()
        batt_percent = battery.percent if battery else "N/A"
        batt_plugged = "Plugged In" if battery and battery.power_plugged else "On Battery"
        gpus = GPUtil.getGPUs()
        gpu_stats = [{"name": g.name, "load_percent": f"{g.load * 100:.1f}%", "temperature_celsius": g.temperature, "vram_used_mb": g.memoryUsed, "vram_total_mb": g.memoryTotal} for g in gpus]
        return json.dumps({"cpu_utilization": f"{cpu_usage}%", "ram_used_gb": f"{ram.used / (1024**3):.2f} GB", "battery_status": f"{batt_percent}% ({batt_plugged})", "gpu_telemetry": gpu_stats if gpu_stats else "No discrete GPU."})
    except Exception as e:
        return json.dumps({"error": str(e)})

AVAILABLE_TOOLS = {
    "search_the_web": search_the_web,
    "scrape_webpage": scrape_webpage,
    "check_system_status": check_system_status,
    "search_images": search_images,
    "search_news": search_news,
    "get_system_telemetry": get_system_telemetry,
    "execute_os_action": execute_os_action,
    "save_to_memory": save_to_memory,
    "run_terminal_command": run_terminal_command,
    "type_in_notepad": type_in_notepad, 
    "play_spotify": play_spotify,
    "message_discord": message_discord,
    "dispatch_gmail": dispatch_gmail,
}