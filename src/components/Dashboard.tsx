import React, { useState, useEffect } from 'react';
import type { User, Student, Payment } from '../types';
import { CreditCard, Users, DollarSign, AlertCircle, TrendingUp } from 'lucide-react';
import { PaymentForm } from './PaymentForm';
import { BulkPaymentForm } from './BulkPaymentForm';
import { globalMockStudents, globalMockPayments, updateGlobalStudent, addGlobalPayment } from '../App';

// School fees structure
const SCHOOL_FEES = {
  nursery: 80000,
  primary: 120000,
  secondary: 180000
};

const getSchoolSection = (className: string): 'nursery' | 'primary' | 'secondary' => {
  const lowerClass = className.toLowerCase();
  if (lowerClass.includes('nursery')) return 'nursery';
  if (lowerClass.includes('primary')) return 'primary';
  return 'secondary';
};

interface DashboardProps {
  user?: User;
}

export function Dashboard({ user }: DashboardProps) {
  // Mock user if not provided
  const currentUser = user || {
    id: '1',
    email: 'parent@demo.com',
    role: 'parent' as const,
    full_name: 'John Doe',
    phone: '+234 801 234 5678',
    created_at: new Date().toISOString()
  };

  const [students, setStudents] = useState<Student[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [showBulkPayment, setShowBulkPayment] = useState(false);
  const [showBulkPaymentForm, setShowBulkPaymentForm] = useState(false);
  const [bulkPaymentStudents, setBulkPaymentStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Filter mock data based on user role
    let filteredStudents = [...globalMockStudents]; // Create a copy to avoid reference issues
    
    if (currentUser.role === 'parent') {
      filteredStudents = globalMockStudents.filter(s => s.parent_id === currentUser.id);
    } else if (currentUser.role === 'student') {
      // For students, find their own record
      filteredStudents = globalMockStudents.filter(s => s.user_id === currentUser.id || s.id === currentUser.id);
    }
    
    // Ensure payment_status is correctly typed
    const typedStudents = filteredStudents.map(student => ({
      ...student,
      payment_status: student.payment_status as 'paid' | 'unpaid'
    }));
    
    setStudents(typedStudents);
    setPayments(globalMockPayments);
  }, [currentUser, globalMockStudents.length, globalMockPayments.length]); // Add dependency to re-run when students are added

  const handlePaymentSuccess = (studentId: string, amount: number) => {
    // Update global student data
    const student = globalMockStudents.find(s => s.id === studentId);
    if (student) {
      const newAmountPaid = student.amount_paid + amount;
      const newStatus = newAmountPaid >= student.total_fees ? 'paid' : 'partial';
      
      updateGlobalStudent(studentId, {
        amount_paid: newAmountPaid,
        payment_status: newStatus
      });
    }

    // Add new payment record
    const newPayment: Payment = {
      id: Date.now().toString(),
      student_id: studentId,
      payer_id: currentUser.id,
      amount,
      payment_method: 'card',
      transaction_id: `txn_${Date.now()}`,
      session: '2024/2025',
      term: 'First Term',
      status: 'completed',
      receipt_url: '#',
      created_at: new Date().toISOString()
    };
    
    addGlobalPayment(newPayment);
    
    // Update local state to trigger re-render
    setStudents([...globalMockStudents.filter(s => {
      if (currentUser.role === 'parent') return s.parent_id === currentUser.id;
      if (currentUser.role === 'student') return s.user_id === currentUser.id || s.id === currentUser.id;
      return true;
    }).map(student => ({
      ...student,
      payment_status: student.payment_status as 'paid' | 'unpaid'
    }))]);
    setPayments([...globalMockPayments]);
    setSelectedStudent(null);
  };

  // Role-based filtering for admin view
  const getFilteredStudents = () => {
    if (currentUser.role === 'admin') {
      return globalMockStudents.map(student => ({
        ...student,
        payment_status: student.payment_status as 'paid' | 'unpaid'
      })); // Show all students for admin
    }
    return students;
  };

  const getFilteredPayments = () => {
    if (currentUser.role === 'admin') {
      return globalMockPayments; // Show all payments for admin
    }
    // Filter payments for current user's students
    const userStudentIds = students.map(s => s.id);
    return payments.filter(p => userStudentIds.includes(p.student_id));
  };

  const handleStudentSelect = (student: any) => {
    // Ensure payment_status is correctly typed
    setSelectedStudent({
      ...student,
      payment_status: student.payment_status as 'paid' | 'unpaid'
    });
  };

  if (selectedStudent) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Make Payment</h1>
          <button
            onClick={() => setSelectedStudent(null)}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
        <PaymentForm 
          student={selectedStudent} 
          onSuccess={(amount) => handlePaymentSuccess(selectedStudent.id, amount)}
        />
      </div>
    );
  }

  if (showBulkPaymentForm && bulkPaymentStudents.length > 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Bulk Payment</h1>
          <button
            onClick={() => {
              setShowBulkPaymentForm(false);
              setBulkPaymentStudents([]);
              setSelectedStudents([]);
              setShowBulkPayment(false);
            }}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
        <BulkPaymentForm 
          students={bulkPaymentStudents}
          onSuccess={(payments) => {
            payments.forEach(payment => {
              handlePaymentSuccess(payment.studentId, payment.amount);
            });
            setShowBulkPaymentForm(false);
            setBulkPaymentStudents([]);
            setSelectedStudents([]);
            setShowBulkPayment(false);
          }}
          onCancel={() => {
            setShowBulkPaymentForm(false);
            setBulkPaymentStudents([]);
          }}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const displayStudents = getFilteredStudents();
  const displayPayments = getFilteredPayments();

  const totalStudents = displayStudents.length;
  const paidStudents = displayStudents.filter(s => s.payment_status === 'paid').length;
  const unpaidStudents = displayStudents.filter(s => s.payment_status === 'unpaid').length;
  const totalRevenue = displayPayments.filter(p => p.status === 'completed').reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">
          Welcome back, {currentUser?.full_name}!
        </h1>
        <p className="text-blue-100">
          {currentUser?.role === 'parent' && 'Manage your children\'s school payments'}
          {currentUser?.role === 'student' && 'View and pay your school fees'}
          {currentUser?.role === 'admin' && 'Monitor school payment activities'}
        </p>
      </div>

      {/* School Fees Structure */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">School Fees Structure (2024/2025 Session)</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-medium text-green-800 mb-2">Nursery Section</h3>
            <p className="text-2xl font-bold text-green-600">₦{SCHOOL_FEES.nursery.toLocaleString()}</p>
            <p className="text-sm text-green-700">Per Term</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-800 mb-2">Primary Section</h3>
            <p className="text-2xl font-bold text-blue-600">₦{SCHOOL_FEES.primary.toLocaleString()}</p>
            <p className="text-sm text-blue-700">Per Term (Primary 1-6)</p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h3 className="font-medium text-purple-800 mb-2">Secondary Section</h3>
            <p className="text-2xl font-bold text-purple-600">₦{SCHOOL_FEES.secondary.toLocaleString()}</p>
            <p className="text-sm text-purple-700">Per Term (JSS 1-3, SS 1-3)</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Students</p>
              <p className="text-2xl font-bold text-gray-900">{totalStudents}</p>
            </div>
            <Users className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Paid</p>
              <p className="text-2xl font-bold text-gray-900">{paidStudents}</p>
            </div>
            <div className="bg-green-100 p-2 rounded-lg">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Unpaid</p>
              <p className="text-2xl font-bold text-gray-900">{unpaidStudents}</p>
            </div>
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Revenue</p>
              <p className="text-2xl font-bold text-gray-900">₦{totalRevenue.toLocaleString()}</p>
            </div>
            <div className="bg-yellow-100 p-2 rounded-lg">
              <CreditCard className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Students */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              {currentUser?.role === 'parent' ? 'Your Children' : currentUser?.role === 'student' ? 'Your Record' : 'All Students'}
            </h2>
            {currentUser?.role === 'parent' && displayStudents.filter(s => s.payment_status === 'unpaid').length > 1 && (
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowBulkPayment(true)}
                  className="text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                >
                  Bulk Payment
                </button>
              </div>
            )}
            {currentUser?.role !== 'admin' && !showBulkPayment && (
              <span className="text-sm text-gray-500">
                Click on a student to make payment
              </span>
            )}
          </div>
        </div>
        <div className="p-6">
          {/* Bulk Payment Selection */}
          {showBulkPayment && currentUser?.role === 'parent' && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-blue-900">Select Children to Pay For</h3>
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      const unpaidStudents = displayStudents.filter(s => s.payment_status === 'unpaid');
                      setSelectedStudents(unpaidStudents.map(s => s.id));
                    }}
                    className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setSelectedStudents([])}
                    className="text-sm border border-gray-300 text-gray-700 px-3 py-1 rounded hover:bg-gray-50"
                  >
                    Clear All
                  </button>
                  <button
                    onClick={() => setShowBulkPayment(false)}
                    className="text-sm text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                </div>
              </div>
              
              {selectedStudents.length > 0 && (
                <div className="mb-4 p-3 bg-white rounded border">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Total Amount:</span>
                    <span className="text-lg font-bold text-green-600">
                      ₦{selectedStudents.reduce((total, studentId) => {
                        const student = displayStudents.find(s => s.id === studentId);
                        return total + (student ? (student.total_fees - student.amount_paid) : 0);
                      }, 0).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedStudents.length} student(s) selected
                  </p>
                </div>
              )}
              
              {selectedStudents.length > 0 && (
                <button
                  onClick={() => {
                    const studentsToPayFor = selectedStudents.map(id => 
                      displayStudents.find(s => s.id === id)
                    ).filter(Boolean) as Student[];
                    setBulkPaymentStudents(studentsToPayFor);
                    setShowBulkPaymentForm(true);
                  }}
                  className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors"
                >
                  Proceed to Payment
                </button>
              )}
            </div>
          )}
          
          {displayStudents.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No students found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {displayStudents.slice(0, 8).map((student) => (
                <div 
                  key={student.id} 
                  className={`flex items-center justify-between p-4 rounded-lg transition-all ${
                    showBulkPayment && currentUser?.role === 'parent' && student.payment_status === 'unpaid'
                      ? selectedStudents.includes(student.id)
                        ? 'bg-blue-100 border-2 border-blue-300 cursor-pointer'
                        : 'bg-gray-50 border-2 border-transparent cursor-pointer hover:border-blue-200'
                      : currentUser?.role !== 'admin' && student.payment_status !== 'paid' && !showBulkPayment
                      ? 'hover:bg-blue-50 cursor-pointer border-2 border-transparent hover:border-blue-200' 
                      : 'bg-gray-50'
                  }`}
                  onClick={() => {
                    if (showBulkPayment && currentUser?.role === 'parent' && student.payment_status === 'unpaid') {
                      setSelectedStudents(prev => 
                        prev.includes(student.id) 
                          ? prev.filter(id => id !== student.id)
                          : [...prev, student.id]
                      );
                    } else if (currentUser?.role !== 'admin' && student.payment_status !== 'paid' && !showBulkPayment) {
                      handleStudentSelect(student);
                    }
                  }}
                >
                  <div className="flex items-center space-x-4">
                    {showBulkPayment && currentUser?.role === 'parent' && student.payment_status === 'unpaid' && (
                      <input
                        type="checkbox"
                        checked={selectedStudents.includes(student.id)}
                        onChange={() => {}}
                        className="w-4 h-4 text-blue-600"
                      />
                    )}
                    <div className="flex items-center space-x-4">
                      <div className="bg-blue-100 p-2 rounded-lg">
                        <Users className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">{student.name}</h3>
                        <p className="text-sm text-gray-500">{student.class} • {student.session}</p>
                        {student.parent_id && currentUser?.role === 'admin' && (
                          <p className="text-xs text-blue-600">Parent ID: {student.parent_id}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      student.payment_status === 'paid' 
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {student.payment_status}
                    </span>
                    <p className="text-sm text-gray-500 mt-1">
                      ₦{student.amount_paid.toLocaleString()} / ₦{student.total_fees.toLocaleString()}
                    </p>
                  </div>
                  {((currentUser?.role === 'parent' && student.parent_id === currentUser.id) || 
                    (currentUser?.role === 'student' && (student.user_id === currentUser.id || student.id === currentUser.id))) && 
                   student.payment_status !== 'paid' && !showBulkPayment && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedStudent(student);
                      }}
                      className="ml-3 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                    >
                      Pay Now
                    </button>
                  )}
                  {currentUser?.role !== 'admin' && student.payment_status !== 'paid' && !showBulkPayment && (
                    <p className="text-xs text-blue-600 mt-1">Click to pay</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Payments */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {currentUser?.role === 'admin' ? 'All Recent Payments' : 'Your Payment History'}
          </h2>
        </div>
        <div className="p-6">
          {displayPayments.length === 0 ? (
            <div className="text-center py-8">
              <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No payments yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {displayPayments.slice(0, 5).map((payment) => {
                const student = globalMockStudents.find(s => s.id === payment.student_id);
                return (
                  <div key={payment.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="bg-green-100 p-2 rounded-lg">
                        <CreditCard className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">₦{payment.amount.toLocaleString()}</h3>
                        <p className="text-sm text-gray-500">
                          {student?.name} • {payment.session} • {payment.term}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        payment.status === 'completed' 
                          ? 'bg-green-100 text-green-800'
                          : payment.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {payment.status}
                      </span>
                      <p className="text-sm text-gray-500 mt-1">
                        {new Date(payment.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}