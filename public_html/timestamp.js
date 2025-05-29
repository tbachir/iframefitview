window.displayTimestamp = function () {
    const now = new Date();

    // Date formatting
    const day = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear();

    // Time formatting
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');

    // Build formatted timestamp
    const formattedTimestamp = `${day}/${month}/${year} ${hours}:${minutes}`;

    // Check if a timestamp div already exists
    let timestampDiv = document.querySelector('.refresh-indicator'); // ✅ Même classe

    if (timestampDiv) {
        // Update existing content
        timestampDiv.textContent = 'm.a.j : ' + formattedTimestamp;
    } else {
        // Create new div
        timestampDiv = document.createElement('div');
        timestampDiv.className = 'refresh-indicator'; // ✅ Cohérent
        timestampDiv.textContent = 'm.a.j : ' + formattedTimestamp;

        // Append div to display-view
        let displayviewEl = document.querySelector('.display-view');
        if (displayviewEl) {
            displayviewEl.appendChild(timestampDiv);
        }
    }
}