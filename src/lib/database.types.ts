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
      Comments: {
        Row: {
          id: number
          created_at: string
          ride_id: number
          user_id: string
          comment: string
        }
      }
    }
  }
}
