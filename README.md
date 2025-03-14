# Oportunidades

A web application for discovering and sharing cultural opportunities, developed as part of an NGO's effort to positively impact the cultural sector.

## 🌟 Overview

Oportunidades is an open-source platform designed to connect artists, cultural workers, and organizations with opportunities in the cultural sector. The platform aggregates opportunities from various sources and presents them in a user-friendly interface, making it easier for users to discover relevant opportunities based on their interests, location, and disciplines.

## 🚀 Features

- **Opportunity Discovery**: Browse and search for cultural opportunities
- **Filtering System**: Filter opportunities by discipline, location, dates, and more
- **User Preferences**: Authenticated users can save preferences for personalized results
- **Sharing Functionality**: Share opportunities via WhatsApp, email, LinkedIn, or copy to clipboard
- **Responsive Design**: Works on desktop and mobile devices
- **Caching System**: Redis-based caching for improved performance

## 🛠️ Tech Stack

- **Backend**: Flask (Python)
- **Frontend**: HTML, JavaScript, Tailwind CSS
- **Authentication**: Auth0
- **Database**: Notion API
- **Caching**: Redis/Upstash
- **Deployment**: Vercel

## 📋 Prerequisites

- Python 3.8+
- Node.js and npm
- Redis (optional for local development)

## 🔧 Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-organization/oportunidades.git
   cd oportunidades
   ```

2. Create and activate a virtual environment:
   ```bash
   python -m venv myenv
   source myenv/bin/activate  # On Windows: myenv\Scripts\activate
   ```

3. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Install Node.js dependencies:
   ```bash
   npm install
   ```

5. Create a `.env` file based on the `.env.example` template and fill in your credentials.

6. Build the CSS:
   ```bash
   npm run build
   ```

7. Run the application:
   ```bash
   npm start
   ```

8. Open your browser and navigate to `http://localhost:5001`

## 🧪 Testing

The application includes a testing environment for the sharing functionality. See [SHARING_TESTING.md](SHARING_TESTING.md) for details.

## 🔄 Data Flow

The application fetches data from Notion, processes it, and stores it in Redis for efficient access. See [Preview-flow.md](Preview-flow.md) for a visual representation of the data flow.

## 🤝 Contributing

We welcome contributions from the community! Please see our [CONTRIBUTING.md](CONTRIBUTING.md) file for guidelines on how to contribute to this project.

## 📝 Known Issues

- See the [Issues](https://github.com/your-organization/oportunidades/issues) tab for current issues and feature requests.

## 📜 License

This project is licensed under the [MIT License](LICENSE) - see the LICENSE file for details.

## 🙏 Acknowledgements

- Thanks to all contributors who have helped make this project possible
- Special thanks to the cultural organizations that have supported this initiative

## 📞 Contact

For questions or support, please open an issue or contact us at [your-email@example.com]. 