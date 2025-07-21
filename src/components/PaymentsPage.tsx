import React, { useState, useEffect } from 'react';
import type { User, Payment, Student } from '../types';
import { CreditCard, Search, Filter, Download, Eye, Calendar, TrendingUp } from 'lucide-react';
import { globalMockStudents, globalMockPayments } from '../App';

interface PaymentsPageProps {
  user: User;
}

// School fees structure
const SCHOOL_FEES = {
  nursery: 80000,
  primary: 120000,
  secondary: 180000
};

export function PaymentsPage({ user }: PaymentsPageProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'pending' | 'failed'>('all');
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  useEffect(() => {
    // Filter payments based on user role
    let filteredPayments = globalMockPayments;
    
    if (user.role === 'parent') {
      // Show payments made by this parent
      filteredPayments = globalMockPayments.filter(p => p.payer_id === user.id);
    } else if (user.role === 'student') {
      // Show payments for this student
      filteredPayments = globalMockPayments.filter(p => p.payer_id === user.id);
    }
    
    setPayments(filteredPayments);
  }, [user, globalMockPayments.length]);

  // Filter payments based on search and filters
  const filteredPayments = payments.filter(payment => {
    const student = globalMockStudents.find(s => s.id === payment.student_id);
    const matchesSearch = student?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         payment.transaction_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || payment.status === filterStatus;
    const matchesPeriod = filterPeriod === 'all' || payment.session === filterPeriod;
    
    return matchesSearch && matchesStatus && matchesPeriod;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const totalAmount = filteredPayments
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0);

  const exportReport = () => {
    // Create CSV content with term and session columns
    const csvHeaders = [
      'Transaction ID',
      'Student Name', 
      'Class',
      'Session',
      'Term',
      'Amount',
      'Payment Method',
      'Status',
      'Date',
      'Payer ID'
    ];
    
    const csvData = filteredPayments.map(payment => {
      const student = globalMockStudents.find(s => s.id === payment.student_id);
      return [
        payment.transaction_id,
        student?.name || 'Unknown',
        student?.class || 'Unknown',
        payment.session,
        payment.term,
        payment.amount,
        payment.payment_method,
        payment.status,
        new Date(payment.created_at).toLocaleDateString(),
        payment.payer_id
      ];
    });
    
    const csvContent = [csvHeaders, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `payment_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const PaymentDetailModal = ({ payment }: { payment: Payment }) => {
    const student = globalMockStudents.find(s => s.id === payment.student_id);
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Payment Details</h3>
            <button
              onClick={() => setSelectedPayment(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>

          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3">Transaction Information</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Transaction ID:</span>
                  <span className="font-medium">{payment.transaction_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Amount:</span>
                  <span className="font-medium text-green-600">₦{payment.amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Payment Method:</span>
                  <span className="font-medium capitalize">{payment.payment_method}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(payment.status)}`}>
                    {payment.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Date:</span>
                  <span className="font-medium">{new Date(payment.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3">Student Information</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Student:</span>
                  <span className="font-medium">{student?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Class:</span>
                  <span className="font-medium">{student?.class}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Session:</span>
                  <span className="font-medium">{payment.session}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Term:</span>
                  <span className="font-medium">{payment.term}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex space-x-3 mt-6">
            <button
              onClick={() => setSelectedPayment(null)}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Close
            </button>
            <button
              onClick={() => window.open(payment.receipt_url, '_blank')}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              View Receipt
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
          <p className="text-gray-600">
            {user.role === 'parent' ? 'Track your payment history' : 
             user.role === 'student' ? 'Your payment records' : 
             'Monitor all school payments'}
          </p>
        </div>
        {user.role === 'admin' && (
          <button 
            onClick={exportReport}
            className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Export Report</span>
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Payments</p>
              <p className="text-2xl font-bold text-gray-900">{filteredPayments.length}</p>
            </div>
            <CreditCard className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-gray-900">
                {filteredPayments.filter(p => p.status === 'completed').length}
              </p>
            </div>
            <div className="bg-blue-100 p-2 rounded-lg">
              <TrendingUp className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-gray-900">
                {filteredPayments.filter(p => p.status === 'pending').length}
              </p>
            </div>
            <Calendar className="h-8 w-8 text-yellow-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Amount</p>
              <p className="text-2xl font-bold text-gray-900">₦{totalAmount.toLocaleString()}</p>
            </div>
            <div className="bg-purple-100 p-2 rounded-lg">
              <CreditCard className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search payments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>

          <select
            value={filterPeriod}
            onChange={(e) => setFilterPeriod(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Periods</option>
            <option value="2024/2025">2024/2025</option>
            <option value="2023/2024">2023/2024</option>
          </select>

          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Filter className="h-4 w-4" />
            <span>{filteredPayments.length} payments</span>
          </div>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Student
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Session/Term
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Transaction ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPayments.map((payment) => {
                const student = globalMockStudents.find(s => s.id === payment.student_id);
                return (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{student?.name}</div>
                        <div className="text-sm text-gray-500">{student?.class}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{payment.session}</div>
                      <div className="text-sm text-gray-500">{payment.term}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">₦{payment.amount.toLocaleString()}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 font-mono">{payment.transaction_id}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(payment.status)}`}>
                        {payment.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(payment.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => setSelectedPayment(payment)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => window.open(payment.receipt_url, '_blank')}
                        className="text-green-600 hover:text-green-900"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredPayments.length === 0 && (
          <div className="text-center py-16 px-6 border rounded-lg bg-gray-50 max-w-2xl mx-auto">
            <div className="flex justify-center">
              <div className="bg-blue-100 p-4 rounded-full">
                <CreditCard className="h-16 w-16 text-blue-500" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mt-6 mb-3">No payment records found</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              {searchTerm || filterStatus !== 'all' || filterPeriod !== 'all' ? 
                'We couldn\'t find any payments matching your current filters. Try adjusting your search criteria or removing some filters.' : 
                'There are no payment records in the system yet. Once payments are made, they will appear here.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {(searchTerm || filterStatus !== 'all' || filterPeriod !== 'all') && (
                <button 
                  onClick={() => {
                    setSearchTerm('');
                    setFilterStatus('all');
                    setFilterPeriod('all');
                  }}
                  className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Clear all filters
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {selectedPayment && <PaymentDetailModal payment={selectedPayment} />}
    </div>
  );
}