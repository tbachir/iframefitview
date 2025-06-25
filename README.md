# HuddleBoard

A robust 24/7 display management system designed for enterprise environments, featuring intelligent content refresh, automatic scaling, and comprehensive health monitoring.

## 🎯 Project Overview

HuddleBoard is a dynamic display system optimized for continuous operation on dedicated screens. It automatically scales content, detects changes, and provides real-time monitoring - perfect for dashboards, information displays, and monitoring systems in enterprise environments.

### Key Features

- ✅ **Intelligent Refresh System** - Automatic content change detection with hash-based comparison
- ✅ **Adaptive Scaling** - Universal content scaling that adapts to any screen resolution
- ✅ **24/7 Reliability** - Built for continuous operation with robust error handling
- ✅ **Health Monitoring** - Real-time system health tracking and performance metrics
- ✅ **Memory Management** - Automatic memory leak prevention and cleanup
- ✅ **Visual Status Indicators** - Real-time status banners for monitoring system health
- ✅ **Enterprise Ready** - Optimized for ThinManager and corporate environments

### Target Audience

- **IT Administrators** managing digital signage systems
- **Operations Teams** requiring 24/7 monitoring displays
- **Facilities Management** for information displays
- **Manufacturing** for production dashboards
- **Corporate Communications** for internal displays

### Technologies Used

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Architecture**: Modular class-based design
- **Server**: Any web server (IIS, Apache, Nginx)
- **Compatibility**: Modern browsers, optimized for Chrome
- **Enterprise**: ThinManager compatible

## 🚀 Installation & Setup

### System Requirements

- **Web Server**: IIS 10+, Apache 2.4+, or Nginx 1.18+
- **Browser**: Chrome 90+ (recommended for 24/7 operation)
- **OS**: Windows Server 2019+, Linux, or macOS
- **Memory**: 4GB RAM minimum (8GB recommended for multiple displays)
- **Network**: Stable network connection for content refresh

### Prerequisites

1. **Web Server** with static file serving capability
2. **Modern Browser** for display terminals
3. **Network Access** between displays and server
4. **File System Access** for content management

### Installation Steps

1. **Download and Extract**
   ```bash
   # Clone or download the project
   git clone https://github.com/your-org/huddleboard.git
   cd huddleboard
   ```

2. **Deploy to Web Server**
   
   **For IIS (Windows Server):**
   ```powershell
   # Copy files to IIS directory
   Copy-Item -Path ".\*" -Destination "C:\inetpub\wwwroot\huddleboard\" -Recurse
   
   # Create IIS application
   New-WebApplication -Site "Default Web Site" -Name "huddleboard" -PhysicalPath "C:\inetpub\wwwroot\huddleboard"
   ```

   **For Apache/Nginx (Linux):**
   ```bash
   # Copy files to web directory
   sudo cp -r ./* /var/www/html/huddleboard/
   sudo chown -R www-data:www-data /var/www/html/huddleboard/
   sudo chmod -R 755 /var/www/html/huddleboard/
   ```

3. **Configure Web Server**
   
   **IIS Configuration** (place in web.config):
   ```xml
   <?xml version="1.0" encoding="utf-8"?>
   <configuration>
     <system.webServer>
       <staticContent>
         <clientCache cacheControlMode="DisableCache" />
       </staticContent>
       <httpProtocol>
         <customHeaders>
           <add name="Cache-Control" value="no-cache, no-store, must-revalidate" />
           <add name="Pragma" value="no-cache" />
           <add name="Expires" value="0" />
         </customHeaders>
       </httpProtocol>
     </system.webServer>
   </configuration>
   ```

   **Nginx Configuration:**
   ```nginx
   location /huddleboard/ {
       add_header Cache-Control "no-cache, no-store, must-revalidate";
       add_header Pragma "no-cache";
       expires 0;
   }
   ```

4. **Create Your First Display**
   ```bash
   # Create display directory
   mkdir displays/my-dashboard
   
   # Create content file
   cat > displays/my-dashboard/index.html << 'EOF'
   <!DOCTYPE html>
   <html>
   <head>
       <meta charset="UTF-8">
       <title>My Dashboard</title>
   </head>
   <body>
       <h1>Welcome to HuddleBoard</h1>
       <p>Last updated: <span id="time"></span></p>
       <script>
           document.getElementById('time').textContent = new Date().toLocaleString();
       </script>
   </body>
   </html>
   EOF
   ```

5. **Configure Display**
   Edit `config.js`:
   ```javascript
   window.AppConfig = {
       defaultRefreshInterval: 30000,
       displays: [
           {
               name: "My Dashboard",
               slug: "my-dashboard",
               path: "displays/my-dashboard/index.html",
               refreshInterval: 15000,
               description: "My first HuddleBoard display"
           }
       ]
   };
   ```

## 📖 Usage Guide

### Getting Started

1. **Access the Home Page**
   ```
   http://your-server/huddleboard/
   ```

2. **View a Specific Display**
   ```
   http://your-server/huddleboard/display/#/my-dashboard
   ```

3. **Configure for 24/7 Operation**
   ```bash
   # Chrome kiosk mode (recommended)
   chrome --kiosk \
          --disable-infobars \
          --disable-session-crashed-bubble \
          --disable-background-timer-throttling \
          "http://your-server/huddleboard/display/#/my-dashboard"
   ```

### Configuration Options

#### Basic Display Configuration

```javascript
window.AppConfig = {
    // Global settings
    defaultRefreshInterval: 30000,  // 30 seconds
    maxConsecutiveErrors: 5,        // Error threshold
    networkTimeout: 10000,          // Network timeout
    autoReloadHours: 12,           // Preventive reload interval
    
    // Display definitions
    displays: [
        {
            name: "Production Dashboard",      // Display name
            slug: "production",               // URL identifier
            path: "displays/production/index.html", // File path
            refreshInterval: 15000,           // Custom refresh interval
            description: "Real-time production metrics"
        }
    ]
};
```

#### Advanced Configuration

```javascript
window.AppConfig = {
    // Performance tuning
    memoryThresholdMB: 1500,       // Memory warning threshold
    iframeLoadTimeout: 30000,      // Iframe load timeout
    enableHealthMonitor: true,     // Enable health monitoring
    debugMode: false,              // Debug logging
    
    // Network optimization
    maxRetries: 3,                 // Retry attempts
    retryDelay: 5000,             // Delay between retries
    slowdownMultiplier: 2,        // Error slowdown factor
    
    displays: [/* ... */]
};
```

### Common Use Cases

#### 1. Production Monitoring Dashboard
```javascript
{
    name: "Production Line Status",
    slug: "production-line",
    path: "displays/production/index.html",
    refreshInterval: 5000,  // 5-second updates
    description: "Real-time production line monitoring"
}
```

#### 2. Corporate Information Display
```javascript
{
    name: "Company News & Updates",
    slug: "corporate-news",
    path: "displays/corporate/index.html",
    refreshInterval: 300000,  // 5-minute updates
    description: "Latest company announcements"
}
```

#### 3. System Health Monitor
```javascript
{
    name: "IT Infrastructure Status",
    slug: "infrastructure",
    path: "displays/infrastructure/index.html",
    refreshInterval: 10000,  // 10-second updates
    description: "Server and network status"
}
```

### Status Indicators

HuddleBoard provides visual status indicators:

- **🟢 Green Status**: System operating normally
- **🔴 Red Status**: Connection or server errors
- **🟡 Yellow Status**: Warnings or degraded performance
- **📊 Health Monitor**: Click the health button (bottom-left) for detailed metrics

## 🏗️ Project Structure

```
huddleboard/
├── README.md                           # This file
├── index.html                          # Home page with display list
├── config.js                          # Display configuration
├── web.config                         # IIS configuration
├── display/                           # Display engine
│   ├── index.html                     # Main display application
│   └── assets/                        # Core assets
│       ├── styles.css                 # Global styles
│       ├── health-monitor/            # Health monitoring system
│       │   ├── health-monitor.js      # Health monitoring logic
│       │   └── health-monitor.css     # Health monitor styles
│       └── js/                        # Core JavaScript modules
│           ├── display-manager.js     # Main display orchestration
│           ├── refresh-service.js     # Content refresh management
│           └── scale-handler.js       # Automatic content scaling
└── displays/                          # Display content directory
    ├── example-display/               # Example display
    │   └── index.html                 # Display content
    └── [your-displays]/               # Your custom displays
        └── index.html
```

### Key Files and Their Purposes

| File | Purpose |
|------|---------|
| `config.js` | Central configuration for all displays |
| `display/index.html` | Main display engine and application entry point |
| `display-manager.js` | Orchestrates iframe management and service initialization |
| `refresh-service.js` | Handles intelligent content refresh and change detection |
| `scale-handler.js` | Manages automatic content scaling for different resolutions |
| `health-monitor.js` | Provides system health monitoring and metrics |
| `styles.css` | Global styling and responsive design |

### Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Home Page     │────│  Display Engine  │────│  Content Files  │
│   (index.html)  │    │  (display/)      │    │  (displays/)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                       ┌────────┼────────┐
                       │        │        │
                ┌──────▼──┐ ┌───▼───┐ ┌──▼──────┐
                │Display  │ │Refresh│ │Scale    │
                │Manager  │ │Service│ │Handler  │
                └─────────┘ └───────┘ └─────────┘
                                │
                       ┌────────▼────────┐
                       │ Health Monitor  │
                       └─────────────────┘
```

## 🤝 Contributing Guidelines

### How to Contribute

1. **Fork the Repository**
   ```bash
   git fork https://github.com/your-org/huddleboard.git
   ```

2. **Create a Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make Your Changes**
   - Follow the coding standards below
   - Add appropriate comments
   - Test your changes thoroughly

4. **Submit a Pull Request**
   - Provide a clear description of changes
   - Include any relevant issue numbers
   - Ensure all tests pass

### Coding Standards

- **JavaScript**: ES6+ syntax, 4-space indentation
- **Comments**: French language for internal comments
- **Functions**: JSDoc documentation for public methods
- **Classes**: Clear separation of concerns
- **Error Handling**: Comprehensive try-catch blocks
- **Memory Management**: Proper cleanup in all classes

### Code Style Example

```javascript
/**
 * Exemple de classe suivant les standards du projet
 */
class ExampleService {
    constructor(config) {
        this.config = config;
        this.isDestroyed = false;
        
        // Bind methods pour éviter les problèmes de contexte
        this.boundMethod = this.method.bind(this);
    }

    /**
     * Méthode publique avec documentation JSDoc
     * @param {string} param - Description du paramètre
     * @returns {Promise<boolean>} - Description du retour
     */
    async method(param) {
        if (this.isDestroyed) {
            console.warn('⚠️ Service détruit, impossible d\'exécuter');
            return false;
        }

        try {
            // Logique métier
            return true;
        } catch (error) {
            console.error('❌ Erreur dans method:', error);
            this.recordError(error);
            return false;
        }
    }

    /**
     * Nettoyage des ressources
     */
    cleanup() {
        console.log('🧹 Nettoyage ExampleService');
        this.isDestroyed = true;
        this.config = null;
        this.boundMethod = null;
    }
}
```

### Bug Reporting

When reporting bugs, please include:

1. **Environment Details**
   - Browser version and type
   - Operating system
   - Web server type and version

2. **Steps to Reproduce**
   - Detailed step-by-step instructions
   - Expected vs actual behavior

3. **Error Information**
   - Console error messages
   - Network tab information
   - Health monitor data (if available)

4. **Configuration**
   - Relevant config.js settings
   - Display content (if applicable)

## 🧪 Testing

### Manual Testing Checklist

- [ ] **Display Loading**: All configured displays load correctly
- [ ] **Content Refresh**: Changes are detected and displays update
- [ ] **Scaling**: Content scales properly on different resolutions
- [ ] **Error Recovery**: System recovers from network interruptions
- [ ] **Memory Management**: No memory leaks during extended operation
- [ ] **Health Monitoring**: Status indicators work correctly

### Browser Testing

Test on the following browsers:
- Chrome 90+ (primary target)
- Firefox 88+
- Edge 90+
- Safari 14+ (macOS only)

### Performance Testing

```bash
# Load testing with Apache Bench
ab -n 1000 -c 10 http://your-server/huddleboard/display/#/test-display

# Memory monitoring
# Monitor browser memory usage over 24+ hours
```

### Automated Testing Setup

```javascript
// Example test structure (to be implemented)
describe('HuddleBoard Core', () => {
    test('Display loads correctly', () => {
        // Test implementation
    });
    
    test('Refresh service detects changes', () => {
        // Test implementation
    });
    
    test('Scale handler adapts to viewport', () => {
        // Test implementation
    });
});
```

## 🚀 Deployment

### Production Environment Setup

1. **Web Server Configuration**
   - Enable compression (gzip)
   - Configure proper cache headers
   - Set up SSL/TLS (recommended)
   - Configure logging

2. **Security Considerations**
   ```nginx
   # Nginx security headers
   add_header X-Frame-Options "SAMEORIGIN" always;
   add_header X-Content-Type-Options "nosniff" always;
   add_header Referrer-Policy "strict-origin-when-cross-origin" always;
   ```

3. **Performance Optimization**
   ```xml
   <!-- IIS compression -->
   <httpCompression>
       <scheme name="gzip" dll="%Windir%\system32\inetsrv\gzip.dll" />
       <staticTypes>
           <add mimeType="text/*" enabled="true" />
           <add mimeType="application/javascript" enabled="true" />
       </staticTypes>
   </httpCompression>
   ```

### ThinManager Deployment

For ThinManager environments:

1. **Chrome Container Configuration**
   ```
   Application Type: Chrome Container
   URL: http://server/huddleboard/display/#/display-slug
   Chrome Switches: --disable-background-timer-throttling --disable-renderer-backgrounding
   ```

2. **Terminal Settings**
   ```
   Auto Start: True
   Session Timeout: Disabled
   Power Management: Always On
   Screen Saver: Disabled
   ```

### CI/CD Pipeline

```yaml
# Example GitHub Actions workflow
name: Deploy HuddleBoard
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to server
        run: |
          rsync -avz --delete ./ user@server:/var/www/html/huddleboard/
          ssh user@server "sudo systemctl reload nginx"
```

## 🔧 Troubleshooting

### Common Issues and Solutions

#### Display Not Loading

**Symptoms**: Blank screen or error message
**Solutions**:
1. Check browser console (F12) for JavaScript errors
2. Verify config.js syntax and display path
3. Test direct access to display HTML file
4. Check web server error logs

```bash
# Check file permissions (Linux)
ls -la displays/your-display/

# Test direct file access
curl http://your-server/huddleboard/displays/your-display/index.html
```

#### Refresh Not Working

**Symptoms**: Content doesn't update when changed
**Solutions**:
1. Verify cache headers are set correctly
2. Check network connectivity
3. Monitor browser console for refresh errors
4. Test with manual refresh (Ctrl+F5)

```javascript
// Debug refresh service
console.log('Refresh interval:', refreshService.interval);
console.log('Last hash:', refreshService.lastHash);
```

#### High Memory Usage

**Symptoms**: Browser becomes slow or crashes
**Solutions**:
1. Enable health monitoring to track memory usage
2. Reduce refresh frequency
3. Simplify display content
4. Enable automatic reload

```javascript
// Monitor memory usage
if (window.healthMonitor) {
    console.log('Memory stats:', window.healthMonitor.getMemoryStats());
}
```

#### Scaling Issues

**Symptoms**: Content appears too small or cut off
**Solutions**:
1. Check content dimensions
2. Verify CSS doesn't override scaling
3. Test on target resolution
4. Review scale handler logs

### Error Messages Explanation

| Error | Meaning | Solution |
|-------|---------|----------|
| `Display 'slug' not found` | Display not configured in config.js | Add display to configuration |
| `Iframe load timeout` | Content taking too long to load | Check network/server performance |
| `High memory usage detected` | Memory threshold exceeded | Reduce content complexity or refresh rate |
| `Network error` | Connection to server failed | Check network connectivity |

### Debug Mode

Enable debug mode in config.js:
```javascript
window.AppConfig = {
    debugMode: true,
    // ... other config
};
```

This provides verbose logging for troubleshooting.

## 📄 License & Credits

### License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2025 HuddleBoard Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### Third-Party Acknowledgments

- **Modern CSS Reset**: Inspired by modern CSS reset methodologies
- **JavaScript Patterns**: Following established ES6+ patterns and best practices
- **Enterprise Compatibility**: Designed with ThinManager and corporate environments in mind

### Team & Maintainers

- **Project Lead**: [Your Name]
- **Contributors**: See [CONTRIBUTORS.md](CONTRIBUTORS.md)
- **Support**: [support@yourcompany.com](mailto:support@yourcompany.com)

### Contact Information

- **Issues**: [GitHub Issues](https://github.com/your-org/huddleboard/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/huddleboard/discussions)
- **Email**: [huddleboard@yourcompany.com](mailto:huddleboard@yourcompany.com)

---

## 📊 Project Status

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![Version](https://img.shields.io/badge/version-2.1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Maintenance](https://img.shields.io/badge/maintained-yes-brightgreen)

**Current Version**: 2.1.0  
**Last Updated**: January 2025  
**Stability**: Production Ready  
**Browser Support**: Chrome 90+, Firefox 88+, Edge 90+

---

*For additional technical details and advanced configuration options, please refer to the inline code documentation and configuration examples provided throughout this README.*