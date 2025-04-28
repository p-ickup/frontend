export type Database = {
  public: {
    Tables: {
      Users: {
        Row: {
          user_id: string
          created_at: string
          firstname: string
          lastname: string
          phonenumber: string
          school: string
          photo_url: string
          instagram: string
        }
      }
      Matches: {
        Row: {
          ride_id: number
          created_at: string
          user_id: string
          flight_id: number
        }
      }
      Flights: {
        Row: {
          flight_id: number
          created_at: string
          user_id: string
          flight_no: string
          bag_no: number
          max_price: number
          max_dropoff: number
          airport: string
          earliest_time: string
          latest_time: string
          date: string
          to_airport: boolean
          terminal: string
          matched: boolean
        }
      }
      MatchRequests: {
        Row: {
          id: string
          sender_id: string
          receiver_id: string
          sender_flight_id: number
          receiver_flight_id: number
          status: 'pending' | 'accepted' | 'rejected'
          created_at: string
        }
      }
    }
  }
}
