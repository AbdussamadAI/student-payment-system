export type User = {
  id: string;
  email: string;
  role: 'parent' | 'student' | 'admin';
  full_name: string;
  phone?: string;
  created_at: string;
};

export type Student = {
  id: string;
  name: string;
  class: string;
  session: string;
  term: string;
  parent_id?: string;
  email?: string; // Added for payment integration
  phone?: string; // Added for payment integration
  payment_status: 'paid' | 'unpaid';
  total_fees: number;
  amount_paid: number;
  user_id?: string; // For student users
  created_at: string;
};

export type Payment = {
  id: string;
  student_id: string;
  payer_id: string;
  amount: number;
  payment_method: string;
  transaction_id: string;
  session: string;
  term: string;
  status: 'pending' | 'completed' | 'failed';
  receipt_url?: string;
  created_at: string;
};

export type Session = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
};

export type Term = {
  id: string;
  session_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
};