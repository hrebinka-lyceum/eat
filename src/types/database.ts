// ---------------------------------------------------------------------------
//  Типи бази даних.
//
//  Джерело істини — db/school_meals_schema.sql, уже розгорнута на сервері.
//  Регенерувати після будь-якої зміни схеми:
//
//    SUPABASE_ACCESS_TOKEN=... npm run gen:types
//
//  (потрібен особистий токен Supabase; поки його немає, файл підтримується
//  вручну й точно відповідає схемі).
// ---------------------------------------------------------------------------

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type UserRole = 'superadmin' | 'admin' | 'cafeteria' | 'teacher' | 'student'
export type ProfileStatus = 'active' | 'disabled'
export type MenuStatus = 'draft' | 'published' | 'closed'
export type DishCategory = 'first' | 'second' | 'side' | 'drink' | 'bakery'

export type PurgeScope = 'orders' | 'menus' | 'privilege_log' | 'graduated_students'

export interface Database {
  public: {
    Tables: {
      settings: {
        Row: {
          id: boolean
          cutoff_time: string
          cutoff_days_before: number
          timezone: string
          current_year: string
          login_domain: string
        }
        Insert: {
          id?: boolean
          cutoff_time?: string
          cutoff_days_before?: number
          timezone?: string
          current_year?: string
          login_domain?: string
        }
        Update: {
          id?: boolean
          cutoff_time?: string
          cutoff_days_before?: number
          timezone?: string
          current_year?: string
          login_domain?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          role: UserRole
          status: ProfileStatus
          full_name: string
          must_change_password: boolean
          created_at: string
        }
        Insert: never
        Update: {
          role?: UserRole
          status?: ProfileStatus
          full_name?: string
          must_change_password?: boolean
        }
        Relationships: []
      }
      classes: {
        Row: {
          id: string
          name: string
          academic_year: string
          teacher_id: string | null
          total_students: number | null
        }
        Insert: {
          id?: string
          name: string
          academic_year: string
          teacher_id?: string | null
          total_students?: number | null
        }
        Update: {
          name?: string
          academic_year?: string
          teacher_id?: string | null
          total_students?: number | null
        }
        Relationships: []
      }
      students: {
        Row: {
          id: string
          class_id: string
          last_name: string
          first_name: string
          profile_id: string | null
          is_privileged: boolean
          privilege_note: string | null
          is_active: boolean
          enrolled_from: string
          left_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          class_id: string
          last_name: string
          first_name: string
          profile_id?: string | null
          is_privileged?: boolean
          privilege_note?: string | null
          is_active?: boolean
          enrolled_from?: string
          left_at?: string | null
        }
        Update: {
          class_id?: string
          last_name?: string
          first_name?: string
          profile_id?: string | null
          is_privileged?: boolean
          privilege_note?: string | null
          is_active?: boolean
          enrolled_from?: string
          left_at?: string | null
        }
        Relationships: []
      }
      class_enrollments: {
        Row: {
          id: string
          student_id: string
          class_id: string
          from_date: string
          to_date: string | null
        }
        // Пишуть лише transfer_student, promote_academic_year і тригер.
        Insert: never
        Update: never
        Relationships: []
      }
      privilege_log: {
        Row: {
          id: number
          student_id: string
          old_value: boolean | null
          new_value: boolean
          changed_by: string | null
          changed_at: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      dishes: {
        Row: {
          id: string
          name: string
          category: DishCategory
          price: number | null
          is_active: boolean
        }
        Insert: {
          id?: string
          name: string
          category: DishCategory
          price?: number | null
          is_active?: boolean
        }
        Update: {
          name?: string
          category?: DishCategory
          price?: number | null
          is_active?: boolean
        }
        Relationships: []
      }
      menu_days: {
        Row: {
          menu_date: string
          status: MenuStatus
          cutoff_at: string
          created_at: string
        }
        Insert: {
          menu_date: string
          status?: MenuStatus
          cutoff_at?: string
        }
        Update: {
          status?: MenuStatus
          cutoff_at?: string
        }
        Relationships: []
      }
      menu_items: {
        Row: {
          id: string
          menu_date: string
          dish_id: string
          price: number | null
        }
        Insert: {
          id?: string
          menu_date: string
          dish_id: string
          price?: number | null
        }
        Update: {
          price?: number | null
        }
        Relationships: []
      }
      orders: {
        Row: {
          id: string
          menu_date: string
          student_id: string
          class_id: string
          privileged_at_order: boolean
          after_cutoff: boolean
          created_by: string | null
          created_at: string
        }
        // Створюються лише через place_order; delete дозволений адміністрації.
        Insert: never
        Update: never
        Relationships: []
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          menu_item_id: string
          price_at_order: number | null
        }
        Insert: never
        Update: never
        Relationships: []
      }
      purge_log: {
        Row: {
          id: number
          performed_by: string | null
          performed_at: string
          period_from: string
          period_to: string
          scopes: string[]
          result: Json
        }
        Insert: never
        Update: never
        Relationships: []
      }
    }
    Views: {
      v_orders_by_dish: {
        Row: {
          menu_date: string
          dish_id: string
          dish_name: string
          category: DishCategory
          portions: number
          portions_privileged: number
          portions_late: number
          /** null для ролей без права бачити вартість */
          total_cost: number | null
        }
        Relationships: []
      }
      v_class_coverage: {
        Row: {
          menu_date: string
          class_id: string
          class_name: string
          total_students: number | null
          students_registered: number
          students_ordered: number
          /** скільки з тих, хто харчується, замовили цього дня */
          coverage_registered_pct: number | null
          /** скільки з усього класу харчується; null без total_students */
          coverage_class_pct: number | null
        }
        Relationships: []
      }
      v_daily_totals: {
        Row: {
          menu_date: string
          orders_total: number
          orders_privileged: number
          orders_regular: number
          orders_late: number
          total_cost: number | null
        }
        Relationships: []
      }
      v_student_month: {
        Row: {
          month: string
          student_id: string
          last_name: string
          first_name: string
          class_id: string
          class_name: string
          days_ordered: number
          days_privileged: number
          days_late: number
          total_cost: number | null
        }
        Relationships: []
      }
      v_unassigned_teachers: {
        Row: {
          id: string
          full_name: string
        }
        Relationships: []
      }
    }
    Functions: {
      place_order: {
        Args: { p_student_id: string; p_menu_date: string; p_menu_item_ids?: string[] }
        Returns: string
      }
      transfer_student: {
        Args: { p_student_id: string; p_new_class_id: string; p_from_date?: string }
        Returns: Json
      }
      generate_menu_days: {
        Args: { p_from: string; p_to: string }
        Returns: number
      }
      copy_menu: {
        Args: { p_source: string; p_target: string }
        Returns: number
      }
      promote_academic_year: {
        Args: {
          p_new_year: string
          p_min_grade?: number
          p_max_grade?: number
          p_start_date?: string
        }
        Returns: Json
      }
      purge_preview: {
        Args: { p_from: string; p_to: string }
        Returns: PurgePreview
      }
      purge_data: {
        Args: {
          p_from: string
          p_to: string
          p_scopes: PurgeScope[]
          p_confirm: string
        }
        Returns: Json
      }
    }
    Enums: {
      user_role: UserRole
      profile_status: ProfileStatus
      menu_status: MenuStatus
      dish_category: DishCategory
    }
    CompositeTypes: Record<never, never>
  }
}

export interface PurgePreview {
  orders: number
  order_items: number
  menu_days: number
  menu_items: number
  privilege_log: number
  graduated_students: number
}

type PublicSchema = Database['public']

export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row']
export type TablesInsert<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Update']
export type Views<T extends keyof PublicSchema['Views']> = PublicSchema['Views'][T]['Row']

export type Profile = Tables<'profiles'>
export type Class = Tables<'classes'>
export type Student = Tables<'students'>
export type Dish = Tables<'dishes'>
export type MenuDay = Tables<'menu_days'>
export type MenuItem = Tables<'menu_items'>
export type Order = Tables<'orders'>
export type OrderItem = Tables<'order_items'>
export type Settings = Tables<'settings'>
export type PrivilegeLogEntry = Tables<'privilege_log'>
export type PurgeLogEntry = Tables<'purge_log'>
export type ClassEnrollment = Tables<'class_enrollments'>
