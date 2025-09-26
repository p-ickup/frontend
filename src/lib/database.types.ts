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
          bag_no_large: number
          bag_no_personal: number
          max_price: number
          max_dropoff: number
          airport: string
          earliest_time: string
          latest_time: string
          date: string
          to_airport: boolean
          terminal: string
          matched: boolean
          airline_iata: string
          last_status: string
          last_dep_estimated_utc: string
          last_arr_estimated_utc: string
          last_notified_at: string
          last_notified_delay_min: number
          opt_in: boolean
        }
      }

      Comments: {
        Row: {
          id: number
          created_at: string
          ride_id: number
          user_id: string
          comment: string
        }
      }

      Feedback: {
        Row: {
          feedback_id: number
          user_id: string
          created_at: string
          ride_id: string
          overall: number
          convenience: number
          comments: string
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
