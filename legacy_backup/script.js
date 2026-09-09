// DOM Elements
const hamburger = document.querySelector(".hamburger");
const drawer = document.querySelector("#library-drawer");
const closeBtn = document.querySelector(".close-btn");
const vinylRecord = document.getElementById("vinyl");
const coverArt = document.getElementById("cover-art");
const trackTitle = document.getElementById("track-title");
const playBtnIcon = document.getElementById("play");
const playBtnWrapper = document.querySelector(".play-btn-wrapper");
const prevBtn = document.getElementById("previous");
const nextBtn = document.getElementById("next");
const seekBar = document.querySelector(".seekbaar");
const circle = document.querySelector(".circal");
const songTime = document.querySelector(".songtime");
const totalTime = document.querySelector(".totaltime");
const searchInput = document.querySelector(".search-bar input");

let currentAudio = new Audio();
let songs = [];
let currfolder = "";
let currentSongIndex = 0;

// Drawer Logic
hamburger.addEventListener("click", () => drawer.classList.add("active"));
closeBtn.addEventListener("click", () => drawer.classList.remove("active"));

// Helper: Clean song names safely using Regex
function cleanSongName(track) {
    let name = track.split("/").pop();
    name = decodeURIComponent(name); // Handle %20 etc.
    name = name.replace(/\.mp3$/i, ""); // Remove extension
    // Remove unwanted website names and tags
    name = name.replace(/\(pagalworldi\.com\.co\)/gi, "")
               .replace(/\(koshalworld\.com\)/gi, "")
               .replace(/\(mp3\.pm\)/gi, "")
               .replace(/HindiRapsong2021/gi, "");
    
    // Clean up underscores and dashes
    name = name.replace(/[-_]/g, " ").trim();
    return name || "Unknown Track";
}

// Helper: Format Time
function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return "00:00";
    let mins = Math.floor(seconds / 60);
    let secs = Math.floor(seconds % 60);
    return `${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

// Fetch Songs
async function getSongs(folder) {
    try {
        currfolder = `./public/songs/${folder}`;
        let res = await fetch(`${currfolder}/playlist.json`);
        if (!res.ok) throw new Error("Playlist not found");
        return await res.json();
    } catch (error) {
        console.error("Error fetching songs:", error);
        return [];
    }
}

// Load Folders (Tapes/Playlists)
async function displayFolders() {
    const cardContainer = document.querySelector(".cardContener");
    cardContainer.innerHTML = "";
    const folders = ["lofisongs", "playlist", "seedhemuat"];

    for (let folder of folders) {
        try {
            let res = await fetch(`./public/songs/${folder}/info.json`);
            if (!res.ok) continue;
            let data = await res.json();
            // Handle typo 'tital' if present, otherwise 'title'
            let title = data.title || data.tital || folder; 
            
            cardContainer.innerHTML += `
            <div class="card" data-folder="${folder}">
                <img src="./public/songs/${folder}/cover.jpeg" alt="${title}" onerror="this.src='logo.png'">
                <h3>${title}</h3>
            </div>`;
        } catch (e) {
            console.error("Error loading folder info for:", folder);
        }
    }

    // Attach click listeners to folders
    document.querySelectorAll(".card").forEach(card => {
        card.addEventListener("click", async function () {
            let folder = this.dataset.folder;
            await loadPlaylist(folder);
            
            // Auto play first song when switching folders
            if(songs.length > 0) {
                playTrack(0);
            }
        });
    });
}

// Load Playlist into Drawer
async function loadPlaylist(folder) {
    songs = await getSongs(folder);
    const songUL = document.querySelector(".songslist-ul");
    songUL.innerHTML = "";

    songs.forEach((song, index) => {
        songUL.innerHTML += `
        <li data-index="${index}" class="track-item">
            <img src="song.svg" alt="icon">
            <div class="songinfo">
                <h3>${cleanSongName(song)}</h3>
                <p>Bantora</p>
            </div>
        </li>`;
    });

    // Attach click listeners to tracks
    document.querySelectorAll(".track-item").forEach(item => {
        item.addEventListener("click", function () {
            playTrack(parseInt(this.dataset.index));
            if(window.innerWidth <= 768) {
                drawer.classList.remove("active"); // Auto close drawer on mobile
            }
        });
    });
}

// Play Specific Track
function playTrack(index) {
    if (index < 0 || index >= songs.length) return;
    
    currentSongIndex = index;
    let trackPath = songs[index];
    // Remove leading slash if exists to prevent double slashes
    if (trackPath.startsWith("/")) trackPath = trackPath.substring(1);
    
    currentAudio.src = `${currfolder}/${trackPath}`;
    currentAudio.play();
    
    playBtnIcon.src = "pause.svg";
    vinylRecord.classList.add("spinning");
    trackTitle.innerText = cleanSongName(trackPath);
    
    // Try to load cover art for the folder, fallback to logo
    coverArt.src = `${currfolder}/cover.jpeg`;
    coverArt.onerror = () => { coverArt.src = 'logo.png' };

    updateActiveTrackStyle();
}

function updateActiveTrackStyle() {
    document.querySelectorAll(".track-item").forEach(item => {
        item.classList.remove("active-track");
        if (parseInt(item.dataset.index) === currentSongIndex) {
            item.classList.add("active-track");
        }
    });
}

// Global Controls
playBtnWrapper.addEventListener("click", () => {
    if (currentAudio.paused) {
        if(currentAudio.src && currentAudio.src !== window.location.href) {
            currentAudio.play();
            playBtnIcon.src = "pause.svg";
            vinylRecord.classList.add("spinning");
        } else if (songs.length > 0) {
            playTrack(0); // Play first song if nothing loaded
        }
    } else {
        currentAudio.pause();
        playBtnIcon.src = "play.svg";
        vinylRecord.classList.remove("spinning");
    }
});

prevBtn.addEventListener("click", () => {
    if (currentSongIndex > 0) {
        playTrack(currentSongIndex - 1);
    }
});

nextBtn.addEventListener("click", () => {
    if (currentSongIndex < songs.length - 1) {
        playTrack(currentSongIndex + 1);
    }
});

// Auto next on end
currentAudio.addEventListener("ended", () => {
    if (currentSongIndex < songs.length - 1) {
        playTrack(currentSongIndex + 1);
    } else {
        vinylRecord.classList.remove("spinning");
        playBtnIcon.src = "play.svg";
    }
});

// Progress Bar Updates
currentAudio.addEventListener("timeupdate", () => {
    if (!isNaN(currentAudio.duration)) {
        let percent = (currentAudio.currentTime / currentAudio.duration) * 100;
        circle.style.left = percent + "%";
        seekBar.style.background = `linear-gradient(to right, var(--neon-accent) ${percent}%, rgba(255,255,255,0.1) ${percent}%)`;
        
        songTime.innerText = formatTime(currentAudio.currentTime);
        totalTime.innerText = formatTime(currentAudio.duration);
    }
});

// Seek Functionality
seekBar.addEventListener("click", (e) => {
    let rect = seekBar.getBoundingClientRect();
    let percent = (e.clientX - rect.left) / rect.width;
    if (currentAudio.duration) {
        currentAudio.currentTime = percent * currentAudio.duration;
    }
});

// Volume Control
const volRange = document.querySelector(".volrange");
volRange.addEventListener("input", () => {
    currentAudio.volume = volRange.value;
});

// Search functionality
if (searchInput) {
    searchInput.addEventListener("input", function () {
        let val = this.value.toLowerCase();
        document.querySelectorAll(".track-item").forEach(item => {
            let name = item.querySelector("h3").innerText.toLowerCase();
            item.style.display = name.includes(val) ? "flex" : "none";
        });
    });
}

// Initialization
async function main() {
    await displayFolders();
    // Default load playlist if available
    await loadPlaylist("playlist");
    
    // Set initial text but don't play
    if (songs.length > 0) {
        trackTitle.innerText = cleanSongName(songs[0]);
        coverArt.src = `./public/songs/playlist/cover.jpeg`;
        coverArt.onerror = () => { coverArt.src = 'logo.png' };
    }
}

main();