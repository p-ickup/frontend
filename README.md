# PICKUP

A modern web application built with Next.js and Supabase for managing pickup activities and questionnaires, powered by machine learning for intelligent ride matching and scheduling.

## Features

- 🔐 Authentication with Google OAuth
- 🎨 Modern UI with Tailwind CSS
- 🌙 Dark mode support
- 📱 Responsive design
- 🔄 Real-time updates with Supabase
- 📊 Analytics integration with Vercel
- 🤖 ML-powered clustering for ride matching
- 🚗 Integration with ride-sharing services (Uber, Lyft)
- ✈️ Flight tracking and scheduling
- 📊 Data analytics and insights

## Tech Stack

- **Framework**: Next.js 14
- **Authentication**: Supabase Auth
- **Database**: Supabase
- **Styling**: Tailwind CSS
- **State Management**: React Query
- **Machine Learning**: Clustering algorithms for ride matching
- **External APIs**: 
  - Uber API
  - Lyft API
  - Flight tracking APIs

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Set up environment variables:
   Create a `.env.local` file with the following variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   UBER_API_KEY=your_uber_api_key
   LYFT_API_KEY=your_lyft_api_key
   FLIGHT_API_KEY=your_flight_api_key
   ```
4. Run the development server:
   ```bash
   pnpm dev
   ```
5. Open [http://localhost:3000](http://localhost:3000) in your browser


## Features in Development

- Questionnaire system
- Results tracking
- User profiles
- Pickup activity management
- Advanced ML algorithms for ride optimization
- Real-time flight tracking and updates
- Multi-provider ride comparison
- Automated scheduling system

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
