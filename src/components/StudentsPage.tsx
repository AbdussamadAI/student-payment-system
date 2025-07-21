import { useState, useEffect } from 'react';
import { Student } from '../types';
import { globalMockStudents } from '../App';
import { 
  Plus,
  Filter,
  GraduationCap,
  Edit,
  Trash2,
  AlertCircle,
  Users,
  X,
  Search,
  Loader2,
  CheckCircle,
  CreditCard
} from 'lucide-react';
import { generateRRR, initRemitaPayment, verifyPayment } from '../services/remitaService';

// School fees structure
const SCHOOL_FEES = {
  nursery: 80000,
  primary: 120000,
  jss: 120000,
  secondary: 180000
};

interface StudentsPageProps {
  user: any;
  onStudentAdded?: () => void;
}

// Helper function to calculate fees based on class (can be used later)
const calculateFeesByClass = (className: string): number => {
  const lowerClass = className.toLowerCase();
  if (lowerClass.includes('nursery')) return SCHOOL_FEES.nursery;
  if (lowerClass.includes('primary')) return SCHOOL_FEES.primary;
  if (lowerClass.includes('jss')) return SCHOOL_FEES.jss;
  return SCHOOL_FEES.secondary;
};

// Use global mock students data defined in App.tsx

export function StudentsPage({ user, onStudentAdded }: StudentsPageProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [filterClass, setFilterClass] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  
  // Payment-related state
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rrr, setRRR] = useState<string>('');
  const [paymentStage, setPaymentStage] = useState<'initial' | 'rrr_generated' | 'processing' | 'complete'>('initial');
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  useEffect(() => {
    // Filter students based on user role
    let filteredStudents = globalMockStudents;
    
    if (user.role === 'parent') {
      filteredStudents = globalMockStudents.filter(s => s.parent_id === user.id);
    } else if (user.role === 'student') {
      filteredStudents = globalMockStudents.filter(s => s.user_id === user.id);
    }
    
    // Ensure all students have properly typed payment_status
    const typeSafeStudents = filteredStudents.map(student => ({
      ...student,
      // Ensure payment_status is explicitly typed as 'paid' | 'unpaid'
      payment_status: student.payment_status as 'paid' | 'unpaid'
    }));
    
    setStudents(typeSafeStudents);
  }, [user, globalMockStudents]);

  // Function to generate Remita RRR for payment
  const generatePaymentRRR = async () => {
    if (!selectedStudent) return;
    
    // Validate payment amount
    if (paymentAmount <= 0) {
      setError('Amount must be greater than 0');
      return;
    }
    
    if (paymentAmount > (selectedStudent.total_fees - selectedStudent.amount_paid)) {
      setError(`Amount cannot exceed the outstanding balance of ₦${(selectedStudent.total_fees - selectedStudent.amount_paid).toLocaleString()}`);
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // Generate RRR using remitaService
      const response = await generateRRR({
        amount: paymentAmount,
        payerName: selectedStudent.name,
        payerEmail: selectedStudent.email || 'student@example.com',
        payerPhone: selectedStudent.phone || '08012345678',
        description: `School fees payment for ${selectedStudent.name}, Class: ${selectedStudent.class}, Term: ${selectedStudent.term}`
      });
      
      if (response.RRR) {
        console.log('RRR generated successfully:', response.RRR);
        setRRR(response.RRR);
        setPaymentStage('rrr_generated');
      } else {
        setError(response.message || 'Failed to generate payment reference. Please try again.');
      }
    } catch (err: any) {
      console.error('Error generating RRR:', err);
      setError('An error occurred while setting up payment. Please try again: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };
  
  // Function to initiate Remita payment with generated RRR
  const initiateRemitaPayment = () => {
    if (!rrr) {
      setError('Missing RRR. Please generate payment reference first.');
      return;
    }
    
    setPaymentStage('processing');
    setError('');
    
    // Initialize Remita payment widget using remitaService
    initRemitaPayment(
      rrr,
      // On success callback
      (response: any) => {
        console.log('Payment successful:', response);
        // Verify the payment status
        verifyPaymentStatus(rrr);
      },
      // On error callback
      (response: any) => {
        console.error('Payment failed:', response);
        setError(response.message || 'Payment failed. Please try again.');
        setPaymentStage('rrr_generated');
        setLoading(false);
      },
      // On close callback
      () => {
        console.log('Payment widget closed');
        // Only revert if not already in processing verification
        if (paymentStage !== 'complete') {
          setPaymentStage('rrr_generated');
          setLoading(false);
        }
      }
    );
  };
  
  // Function to verify payment status
  const verifyPaymentStatus = async (rrr: string) => {
    if (!selectedStudent) return;
    
    setLoading(true);
    setError('');
    
    try {
      // Verify payment using remitaService
      const response = await verifyPayment(rrr);
      
      if (response.status === '00' || response.status === '01') {
        // Payment successful
        // Update local students array
        const updatedStudents = students.map(s => {
          if (s.id === selectedStudent.id) {
            const newAmountPaid = s.amount_paid + paymentAmount;
            const newStatus = newAmountPaid >= s.total_fees ? 'paid' : 'unpaid' as 'paid' | 'unpaid';
            
            return {
              ...s,
              amount_paid: newAmountPaid,
              payment_status: newStatus
            };
          }
          return s;
        });
        
        // Update the global students array for persistence
        for (let i = 0; i < globalMockStudents.length; i++) {
          if (globalMockStudents[i].id === selectedStudent.id) {
            const newAmountPaid = globalMockStudents[i].amount_paid + paymentAmount;
            globalMockStudents[i].amount_paid = newAmountPaid;
            globalMockStudents[i].payment_status = (newAmountPaid >= globalMockStudents[i].total_fees ? 'paid' : 'unpaid') as 'paid' | 'unpaid';
            break;
          }
        }
        
        setStudents(updatedStudents);
        setPaymentStage('complete');
        setPaymentSuccess(true);
      } else {
        // Payment failed or pending
        setError(`Payment verification failed: ${response.message || 'Unknown error'}`);
        setPaymentStage('rrr_generated'); // Allow retry
      }
    } catch (err: any) {
      console.error('Error verifying payment:', err);
      setError('Failed to verify payment status: ' + (err.message || ''));
      setPaymentStage('rrr_generated'); // Allow retry
    } finally {
      setLoading(false);
    }
  };

  // Load Remita script on component mount
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://demo.remita.net/payment/v1/remita-pay-inline.bundle.js';
    script.async = true;
    document.body.appendChild(script);
    
    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  // Get unique classes for filter
  const classes = [...new Set(students.map(s => s.class))].sort();

  // Filter students based on search and filters
  const filteredStudents = students.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         student.class.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || student.payment_status === filterStatus;
    const matchesClass = filterClass === 'all' || student.class === filterClass;
    
    return matchesSearch && matchesStatus && matchesClass;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'unpaid': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSchoolFees = (className: string): number => {
    const lowerClass = className.toLowerCase();
    if (lowerClass.includes('nursery')) return SCHOOL_FEES.nursery;
    if (lowerClass.includes('primary')) return SCHOOL_FEES.primary;
    return SCHOOL_FEES.secondary;
  };

  const [addError, setAddError] = useState('');

  // Form state with proper initialization
  const [formData, setFormData] = useState({
    name: '',
    class: '',
    session: '2024/2025',
    term: 'First Term',
    parent_id: user.role === 'parent' ? user.id : ''
  });
  
  // Function to add student to global mock data
  const addGlobalStudent = (student: Student) => {
    // Create a new object with all required properties explicitly set
    const newStudent = {
      ...student,
      // Ensure we have either user_id or parent_id depending on the role
      user_id: student.user_id || undefined,
      parent_id: student.parent_id || undefined,
      payment_status: student.payment_status as 'paid' | 'unpaid',
      total_fees: student.total_fees,
      amount_paid: student.amount_paid,
      created_at: student.created_at
    };
    
    // Push the fully typed student to the global array
    globalMockStudents.push(newStudent as any);
  };

  const handleAddStudent = () => {
    // Validation
    if (!formData.name.trim() || !formData.class || !formData.session || !formData.term) {
      setAddError('Please fill in all required fields');
      return;
    }

    // Create new student
    const studentData: Student = {
      id: Date.now().toString(),
      name: formData.name.trim(),
      class: formData.class,
      session: formData.session,
      term: formData.term,
      parent_id: user.role === 'parent' ? user.id : formData.parent_id || undefined,
      payment_status: 'unpaid',
      total_fees: getSchoolFees(formData.class),
      amount_paid: 0,
      created_at: new Date().toISOString()
    };

    // Add to both local state and global mock data for persistence across components
    setStudents(prevStudents => {
      const newStudents = [...prevStudents, studentData];
      // Also update the global mock data
      addGlobalStudent(studentData);
      // Notify parent component to refresh dashboard
      onStudentAdded?.();
      return newStudents;
    });
    
    // Reset form and close modal
    setShowAddModal(false);
    setFormData({
      name: '',
      class: '',
      session: '2024/2025',
      term: 'First Term',
      parent_id: user.role === 'parent' ? user.id : ''
    });
    setAddError('');
  };

  const handleRemoveStudent = (studentId: string) => {
    if (window.confirm('Are you sure you want to remove this child from your account?')) {
      setStudents(prev => prev.filter(s => s.id !== studentId));
      // Also remove from globalMockStudents
      const index = globalMockStudents.findIndex(s => s.id === studentId);
      if (index > -1) {
        globalMockStudents.splice(index, 1);
      }
    }
  };
  
  // Define the student add modal component
  const StudentAddModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">
          {user.role === 'admin' ? 'Add New Student' : 'Add Your Child'}
        </h3>
        <div className="space-y-4">
          <input
            type="text"
            placeholder={user.role === 'admin' ? 'Student Name' : 'Child\'s Name'}
            value={formData.name}
            onChange={(e) => {
              const newName = e.target.value;
              setFormData(prev => ({ ...prev, name: newName }));
            }}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={formData.class}
            onChange={(e) => setFormData(prev => ({ ...prev, class: e.target.value }))}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select Class</option>
            <optgroup label="Nursery Section">
              <option value="Nursery 1">Nursery 1</option>
              <option value="Nursery 2">Nursery 2</option>
            </optgroup>
            <optgroup label="Primary Section">
              <option value="Primary 1">Primary 1</option>
              <option value="Primary 2">Primary 2</option>
              <option value="Primary 3">Primary 3</option>
              <option value="Primary 4">Primary 4</option>
              <option value="Primary 5">Primary 5</option>
              <option value="Primary 6">Primary 6</option>
            </optgroup>
            <optgroup label="Secondary Section">
              <option value="JSS 1A">JSS 1A</option>
              <option value="JSS 1B">JSS 1B</option>
              <option value="JSS 2A">JSS 2A</option>
              <option value="JSS 2B">JSS 2B</option>
              <option value="JSS 3A">JSS 3A</option>
              <option value="JSS 3B">JSS 3B</option>
              <option value="SS 1A">SS 1A</option>
              <option value="SS 1B">SS 1B</option>
              <option value="SS 1C">SS 1C</option>
              <option value="SS 2A">SS 2A</option>
              <option value="SS 2B">SS 2B</option>
              <option value="SS 2C">SS 2C</option>
              <option value="SS 3A">SS 3A</option>
              <option value="SS 3B">SS 3B</option>
              <option value="SS 3C">SS 3C</option>
            </optgroup>
          </select>
          <select
            value={formData.session}
            onChange={(e) => setFormData(prev => ({ ...prev, session: e.target.value }))}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="2024/2025">2024/2025</option>
            <option value="2023/2024">2023/2024</option>
          </select>
          <select
            value={formData.term}
            onChange={(e) => setFormData(prev => ({ ...prev, term: e.target.value }))}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="First Term">First Term</option>
            <option value="Second Term">Second Term</option>
            <option value="Third Term">Third Term</option>
          </select>
          {user.role === 'admin' && (
            <input
              type="text"
              placeholder="Parent ID (optional)"
              value={formData.parent_id}
              onChange={(e) => setFormData(prev => ({ ...prev, parent_id: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
          
          {/* Fee Display */}
          {formData.class && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm font-medium text-blue-800">
                School Fees: ₦{getSchoolFees(formData.class).toLocaleString()} per term
              </p>
            </div>
          )}
        </div>
        
        {/* Validation Error */}
        {addError && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-600">{addError}</p>
          </div>
        )}
        
        <div className="flex space-x-3 mt-6">
          <button
            onClick={() => {
              setShowAddModal(false);
              setFormData({
                name: '',
                class: '',
                session: '2024/2025',
                term: 'First Term',
                parent_id: user.role === 'parent' ? user.id : ''
              });
              setAddError('');
            }}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleAddStudent}
            disabled={!formData.name.trim() || !formData.class}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {user.role === 'admin' ? 'Add Student' : 'Add Child'}
          </button>
        </div>
      </div>
    </div>
  );

  const handleOpenPaymentModal = (student: Student) => {
    setSelectedStudent(student);
    // Calculate remaining amount to pay
    const remainingAmount = student.total_fees - student.amount_paid;
    setPaymentAmount(remainingAmount);
    setPaymentStage('initial');
    setRRR('');
    setError('');
    setPaymentSuccess(false);
    setShowPaymentModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Students</h1>
          <p className="text-gray-600">
            {user.role === 'parent' ? 'Manage your children\'s records' : 
             user.role === 'student' ? 'Your academic record' : 
             'Manage all student records'}
          </p>
        </div>
        {user.role === 'admin' && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Add Student</span>
          </button>
        )}
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search students..."
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
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
          </select>

          <select
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Classes</option>
            {classes.map(cls => (
              <option key={cls} value={cls}>{cls}</option>
            ))}
          </select>

          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Filter className="h-4 w-4" />
            <span>{filteredStudents.length} students</span>
          </div>
        </div>
      </div>

      {/* Students Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredStudents.map((student) => (
          <div key={student.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <GraduationCap className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{student.name}</h3>
                  <p className="text-sm text-gray-500">{student.class}</p>
                </div>
              </div>
              {(user.role === 'admin' || user.role === 'parent') && (
                <div className="flex space-x-1">
                  {user.role === 'admin' && (
                    <button className="p-1 text-gray-400 hover:text-blue-600">
                      <Edit className="h-4 w-4" />
                    </button>
                  )}
                  <button 
                    onClick={() => handleRemoveStudent(student.id)}
                    className="p-1 text-gray-400 hover:text-red-600"
                    title={user.role === 'parent' ? 'Remove child' : 'Delete student'}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Session:</span>
                <span className="font-medium">{student.session}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Term:</span>
                <span className="font-medium">{student.term}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Fees:</span>
                <span className="font-medium">₦{student.total_fees.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Amount Paid:</span>
                <span className="font-medium text-green-600">₦{student.amount_paid.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Outstanding:</span>
                <span className="font-medium text-red-600">
                  ₦{(student.total_fees - student.amount_paid).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(student.payment_status)}`}>
                {student.payment_status}
              </span>
              
              {student.payment_status !== 'paid' && user.role !== 'admin' && (
                <button 
                  onClick={() => handleOpenPaymentModal(student)}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Pay Now
                </button>
              )}
            </div>

            {student.payment_status === 'unpaid' && (
              <div className="mt-3 flex items-center space-x-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                <AlertCircle className="h-3 w-3" />
                <span>Payment overdue</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredStudents.length === 0 && (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No students found</h3>
          <p className="text-gray-500">Try adjusting your search or filter criteria</p>
        </div>
      )}
      {user.role === 'parent' && (
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Add Child</span>
        </button>
      )}

      {showAddModal && StudentAddModal()} 
      
      {/* Payment Modal */}
      {showPaymentModal && selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Make Payment</h3>
              <button 
                onClick={() => {
                  if (paymentStage !== 'processing') {
                    setShowPaymentModal(false)
                  }
                }} 
                className="text-gray-500 hover:text-gray-700"
                disabled={paymentStage === 'processing'}
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Payment stage display */}
            {paymentStage === 'complete' && paymentSuccess ? (
              <div className="p-6 text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Payment Successful!</h3>
                <p className="text-sm text-gray-500 mb-6">
                  Thank you for your payment. The receipt has been generated for your records.
                </p>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  Continue
                </button>
              </div>
            ) : (
              <div className="p-4">
                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                    <div className="flex items-start">
                      <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                      <p className="text-sm text-red-800">{error}</p>
                    </div>
                  </div>
                )}
                
                {/* Student and payment info */}
                <div className="mb-6 p-4 bg-gray-50 rounded-md">
                  <h4 className="font-medium text-gray-800 mb-2">{selectedStudent.name}</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-gray-600">Class:</p>
                      <p className="font-medium">{selectedStudent.class}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Term:</p>
                      <p className="font-medium">{selectedStudent.term}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Total Fees:</p>
                      <p className="font-medium">₦{selectedStudent.total_fees.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Amount Paid:</p>
                      <p className="font-medium">₦{selectedStudent.amount_paid.toLocaleString()}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-gray-600">Outstanding Balance:</p>
                      <p className="font-bold text-lg">₦{(selectedStudent.total_fees - selectedStudent.amount_paid).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
                
                {/* Payment stages */}
                {paymentStage === 'initial' && (
                  <div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Payment Amount (₦)
                      </label>
                      <input
                        type="number"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(Math.min(Number(e.target.value), selectedStudent.total_fees - selectedStudent.amount_paid))}
                        min="1"
                        max={selectedStudent.total_fees - selectedStudent.amount_paid}
                        className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={loading}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Maximum amount: ₦{(selectedStudent.total_fees - selectedStudent.amount_paid).toLocaleString()}
                      </p>
                    </div>
                    
                    <div className="mb-4">
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="card"
                          name="payment_method"
                          checked
                          readOnly
                          className="h-4 w-4 text-blue-600"
                        />
                        <CreditCard className="h-5 w-5 text-blue-500" />
                        <label htmlFor="card" className="text-sm text-blue-700">Credit/Debit Card via Remita</label>
                      </div>
                    </div>
                    
                    <button
                      onClick={generatePaymentRRR}
                      disabled={loading || paymentAmount <= 0 || paymentAmount > (selectedStudent.total_fees - selectedStudent.amount_paid)}
                      className={`w-full flex items-center justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${loading ? 'opacity-75 cursor-not-allowed' : ''}`}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          <span>Processing...</span>
                        </>
                      ) : (
                        'Continue to Payment'
                      )}
                    </button>
                  </div>
                )}
                
                {paymentStage === 'rrr_generated' && (
                  <div className="w-full">
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-blue-800">Payment Reference (RRR):</span>
                        <span className="font-mono font-bold text-blue-800">{rrr}</span>
                      </div>
                    </div>
                    <button
                      onClick={initiateRemitaPayment}
                      className="flex items-center justify-center w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                      Pay Now with Remita
                    </button>
                  </div>
                )}
                
                {paymentStage === 'processing' && (
                  <div className="w-full text-center py-6">
                    <Loader2 className="w-12 h-12 animate-spin mx-auto text-blue-600 mb-4" />
                    <p className="text-sm text-gray-600">Processing your payment...</p>
                    <p className="text-xs text-gray-500 mt-1">Please do not close this window.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}