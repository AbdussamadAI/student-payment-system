import React, { useState, useEffect } from 'react';
import { Student } from '../types';
import { AlertCircle, CheckCircle, Users, CreditCard, Loader2 } from 'lucide-react';
import { generateRRR, verifyPayment } from '../services/remitaService';
import { globalMockPayments, updateGlobalStudent } from '../App';

interface BulkPaymentFormProps {
  students: Student[];
  onSuccess: (payments: { studentId: string; amount: number }[]) => void;
  onCancel: () => void;
}

export function BulkPaymentForm({ students: initialStudents, onSuccess, onCancel }: BulkPaymentFormProps) {
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [rrr, setRRR] = useState('');
  const [paymentStage, setPaymentStage] = useState<'initial' | 'rrr_generated' | 'processing' | 'complete'>('initial');
  const [totalAmount, setTotalAmount] = useState(initialStudents.reduce((sum, s) => sum + s.total_fees - s.amount_paid, 0));
  const [verificationTimeout, setVerificationTimeout] = useState<NodeJS.Timeout | null>(null);
  const [verificationAttempts, setVerificationAttempts] = useState(0);
  
  // Combine all student names for Remita payer name
  const studentNames = students.map(s => s.name.split(' ')[0]).join(', ');
  // Get email from first student (or use default)
  const studentEmail = students[0]?.email || 'student@schoolpay.com';
  
  // Load Remita script on component mount
  useEffect(() => {
    // Function to load Remita payment script
    const loadRemitaScript = () => {
      // Check if script is already loaded
      if (document.querySelector('script[src*="remita-pay-inline"]')) {
        return Promise.resolve();
      }
      
      return new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://remitademo.net/payment/v1/remita-pay-inline.bundle.js';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Remita script'));
        document.body.appendChild(script);
      });
    };
    
    // Load the script
    loadRemitaScript()
      .then(() => console.log('Remita script loaded successfully'))
      .catch((err) => {
        console.error('Failed to load Remita script:', err);
        setError('Failed to initialize payment system. Please refresh and try again.');
      });
      
    // Clean up function
    return () => {
      // Clear any verification timeouts on unmount
      if (verificationTimeout) {
        clearTimeout(verificationTimeout);
      }
    };
  }, []);  

  // Add Remita payment verification effect
  useEffect(() => {
    // Only attempt to verify if we have an RRR and we're in processing stage
    if (rrr && paymentStage === 'processing') {
      // Set a timeout to automatically stop verification after 2 minutes (120 seconds)
      const maxVerificationTimeMs = 120000; // 2 minutes
      const startTime = Date.now();
      
      // Create a variable to track if verification is still active
      let verificationActive = true;
      
      const verifyRRRStatus = async () => {
        // Check if verification is still active
        if (!verificationActive) return;
        
        try {
          const response = await verifyPayment(rrr);
          
          // Check if time limit has been exceeded
          if (Date.now() - startTime > maxVerificationTimeMs) {
            setError('Payment verification timeout. If you completed the payment, click "Verify Payment" to check the status again.');
            setPaymentStage('initial');
            setLoading(false);
            verificationActive = false;
            return;
          }
          
          if (response.status === '00' || response.status === '01') {
            // Payment successful
            const receipt = generateBulkReceipt(rrr);
            setReceiptData(receipt);
            
            // Mark all students as paid
            students.forEach(student => {
              const amountToPay = student.total_fees - student.amount_paid;
              const newAmountPaid = student.amount_paid + amountToPay;
              
              // Update student payment status
              updateGlobalStudent(student.id, {
                amount_paid: newAmountPaid,
                payment_status: 'paid'
              });
            });
            
            setSuccess(true);
            setPaymentStage('complete');
            verificationActive = false; // Stop verification process
          } else if (response.status === '021') {
            // Payment pending, try again after a delay
            setVerificationAttempts(prev => prev + 1);
            const timeout = setTimeout(verifyRRRStatus, 5000); // Wait 5 seconds before trying again
            setVerificationTimeout(timeout);
          } else {
            // Payment failed or status unknown
            setError(`Payment verification failed: ${response.message || 'Unknown status'}`);
            setPaymentStage('initial'); // Reset to initial state
            setLoading(false);
            verificationActive = false;
          }
        } catch (err: any) {
          if (verificationAttempts < 3) {
            // If fewer than 3 attempts, try again after a delay
            setVerificationAttempts(prev => prev + 1);
            setTimeout(() => {
              if (verificationActive) {
                verifyRRRStatus(); // Run verification again
              }
            }, 3000); // Try again after 3 seconds
          } else {
            // Too many errors, stop trying
            setError(`Error verifying payment: ${err.message || 'Unknown error'}. If you completed the payment, click "Verify Payment" to check status.`);
            setPaymentStage('initial');
            setLoading(false);
            verificationActive = false; // Stop verification process
          }
        }
      };
      
      // Start verification process
      verifyRRRStatus();
      
      // Cleanup function to stop verification if component unmounts
      return () => {
        verificationActive = false;
      };
    }
  }, [rrr, paymentStage, students]);
  
  // Manual verification function for user to trigger if automatic process fails
  const verifyPaymentManually = async () => {
    if (!rrr) {
      setError('No payment reference to verify.');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const response = await verifyPayment(rrr);
      
      if (response.status === '00' || response.status === '01') {
        // Payment successful
        const receipt = generateBulkReceipt(rrr);
        setReceiptData(receipt);
        
        // Mark all students as paid
        students.forEach(student => {
          const amountToPay = student.total_fees - student.amount_paid;
          const newAmountPaid = student.amount_paid + amountToPay;
          
          // Update student payment status
          updateGlobalStudent(student.id, {
            amount_paid: newAmountPaid,
            payment_status: 'paid'
          });
        });
        
        setSuccess(true);
        setPaymentStage('complete');
      } else if (response.status === '021') {
        setError('Payment is still pending. Please wait a moment and try verifying again.');
        setLoading(false);
      } else {
        // Payment failed
        setError(`Payment verification failed: ${response.message || 'Unknown error'}`);
        setLoading(false);
      }
    } catch (err: any) {
      setError(`Error verifying payment: ${err.message || 'Unknown error'}`);
      setLoading(false);
    }
  };

  // Generate bulk receipt with all students and payment information
  const generateBulkReceipt = (transactionId: string) => {
    const receiptData = {
      transactionId,
      totalAmount,
      studentCount: students.length,
      students: students.map(student => ({
        name: student.name,
        class: student.class,
        amount: student.total_fees - student.amount_paid
      })),
      session: students[0]?.session || '2024/2025',
      term: students[0]?.term || 'First Term',
      paymentDate: new Date().toLocaleDateString(),
      paymentTime: new Date().toLocaleTimeString(),
      paymentMethod: 'Remita',
      status: 'Completed'
    };
    
    // Generate receipt HTML and create URL for download
    const receiptHtml = generateBulkReceiptHTML(receiptData);
    const receiptBlob = new Blob([receiptHtml], { type: 'text/html' });
    const receiptUrl = URL.createObjectURL(receiptBlob);
    
    // Add receipt URL to the receipt data
    return {
      ...receiptData,
      receiptUrl
    };
  };

  // Generate HTML for bulk payment receipt
  const generateBulkReceiptHTML = (receipt: any) => {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bulk Payment Receipt</title>
          <meta charset="UTF-8">
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 20px; 
              line-height: 1.6;
            }
            .receipt-header { 
              text-align: center; 
              margin-bottom: 20px; 
              border-bottom: 2px solid #333;
              padding-bottom: 10px;
            }
            .receipt-content { 
              max-width: 800px; 
              margin: 0 auto; 
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
            }
            th, td {
              padding: 10px;
              border: 1px solid #ddd;
              text-align: left;
            }
            th {
              background-color: #f5f5f5;
            }
            .total-row {
              font-weight: bold;
              background-color: #f9f9f9;
            }
            .footer {
              text-align: center;
              font-size: 0.8em;
              margin-top: 30px;
              border-top: 1px solid #ddd;
              padding-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="receipt-content">
            <div class="receipt-header">
              <h1>School Payment System</h1>
              <h2>Bulk Payment Receipt</h2>
              <p><strong>Transaction ID:</strong> ${receipt.transactionId}</p>
            </div>
            
            <div>
              <h3>Payment Summary</h3>
              <p><strong>Date:</strong> ${receipt.paymentDate} ${receipt.paymentTime}</p>
              <p><strong>Payment Method:</strong> ${receipt.paymentMethod}</p>
              <p><strong>Status:</strong> ${receipt.status}</p>
              <p><strong>Session:</strong> ${receipt.session}</p>
              <p><strong>Term:</strong> ${receipt.term}</p>
            </div>
            
            <div>
              <h3>Students Paid For</h3>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Student Name</th>
                    <th>Class</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${receipt.students.map((student: any, index: number) => `
                    <tr>
                      <td>${index + 1}</td>
                      <td>${student.name}</td>
                      <td>${student.class}</td>
                      <td>₦${student.amount.toLocaleString()}</td>
                    </tr>
                  `).join('')}
                  <tr class="total-row">
                    <td colspan="3">Total Amount</td>
                    <td>₦${receipt.totalAmount.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <div class="footer">
              <p>This receipt was automatically generated by the School Payment System.</p>
              <p>For any inquiries, please contact the school administration.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  };

  // Generate RRR for payment
  // Step 1: Generate RRR
  const generatePaymentRRR = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalAmount <= 0) {
      setError('Total amount must be greater than 0');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // Get a Remita Retrieval Reference (RRR) for this payment
      const response = await generateRRR({
        amount: totalAmount,
        payerName: `School Fees: ${studentNames}`,
        payerEmail: studentEmail,
        payerPhone: students[0]?.phone || '08012345678',
        description: `Bulk school fees payment for ${students.length} students`
      });
      
      if (response.RRR) {
        setRRR(response.RRR);
        setPaymentStage('rrr_generated');
        setLoading(false);
      } else {
        throw new Error('Failed to generate RRR');
      }
    } catch (err: any) {
      setError(`Error: ${err.message || 'Something went wrong'}`);
      setLoading(false);
    }
  };
  
  // Step 2: Initiate Remita Payment
  const initiateRemitaPayment = () => {
    setLoading(true);
    
    // Check if Remita script is loaded
    if (typeof window === 'undefined' || !(window as any).RmPaymentEngine) {
      console.error('Remita payment engine not loaded');
      setError('Payment system not loaded. Please refresh the page and try again.');
      setLoading(false);
      return;
    }
    
    console.log('Remita payment engine found:', (window as any).RmPaymentEngine);
    
    // Initialize the Remita inline payment
    try {
      // Set payment stage to indicate we're starting the payment process
      setPaymentStage('processing');
      
      const paymentEngine = (window as any).RmPaymentEngine.init({
        key: 'QzAwMDAyNzEyNTl8MTEwNjE4NjF8OWZjOWYwNmMyZDk3MDRhYWM3YThiOThlNTNjZTE3ZjYxOTY5NDdmZWE1YzU3NDc0ZjE2ZDZjNTg1YWYxNWY3NWM4ZjMzNzZhNjNhZWZlOWQwNmJhNTFkMjIxYTRiMjYzZDkzNGQ3NTUxNDIxYWNlOGY4ZWEyODY3ZjlhNGUwYTY=',
        processRrr: true,
        transactionId: Math.floor(Math.random() * 1101233),
        extendedData: {
          customFields: [{
            name: "rrr",
            value: rrr
          }]
        },
        onSuccess: (response: any) => {
          console.log('Remita payment successful:', response);
          // Once payment completes, verify the payment
          verifyPaymentManually();
        },
        onError: (error: any) => {
          console.error('Remita payment error:', error);
          setError('Payment failed or was cancelled. Please try again.');
          setLoading(false);
          setPaymentStage('rrr_generated'); // Revert back to rrr_generated state
        },
        onClose: () => {
          // Only reset if not already completed
          if (paymentStage !== 'complete') {
            setLoading(false);
            // Reset to RRR generated state to allow retry
            setPaymentStage('rrr_generated');
          }
        }
      });
      
      // Display the payment widget
      paymentEngine.showPaymentWidget();
    } catch (error) {
      console.error('Error initializing Remita payment:', error);
      setError('Failed to initialize payment. Please refresh and try again.');
      setLoading(false);
      setPaymentStage('rrr_generated'); // Revert to previous state
    }
  };
  
  // Form submission is handled directly by generatePaymentRRR

  const handleContinue = () => {
    // Create payment records for each student
    const payments = students.map(student => {
      // Calculate student amount
      const amount = student.total_fees - student.amount_paid;
      
      // Create payment record
      const newPayment = {
        id: `${Date.now()}_${student.id}`,
        student_id: student.id,
        payer_id: student.parent_id,
        amount: amount,
        payment_method: 'remita',
        transaction_id: receiptData.transactionId,
        session: student.session,
        term: student.term,
        status: 'completed',
        receipt_url: receiptData.receiptUrl,
        created_at: new Date().toISOString()
      };
      
      // Add to global payments array
      globalMockPayments.unshift(newPayment);
      
      return {
        studentId: student.id,
        amount: amount
      };
    });
    
    onSuccess(payments);
  };

  if (success && receiptData) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        {/* Success Header */}
        <div className="text-center mb-6">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Bulk Payment Successful!</h2>
          <p className="text-gray-600">Payment for {receiptData.studentCount} students has been processed successfully</p>
        </div>

        {/* Receipt */}
        <div id="bulk-payment-receipt" className="bg-gray-50 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">Bulk Payment Receipt</h3>
          
          <div className="space-y-3 text-sm mb-6">
            <div className="flex justify-between">
              <span className="text-gray-600">Transaction ID:</span>
              <span className="font-medium">{receiptData.transactionId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Number of Students:</span>
              <span className="font-medium">{receiptData.studentCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Session:</span>
              <span className="font-medium">{receiptData.session}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Term:</span>
              <span className="font-medium">{receiptData.term}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Payment Date:</span>
              <span className="font-medium">{receiptData.paymentDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Payment Time:</span>
              <span className="font-medium">{receiptData.paymentTime}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Payment Method:</span>
              <span className="font-medium">{receiptData.paymentMethod}</span>
            </div>
          </div>

          {/* Student Details */}
          <div className="border-t pt-4 mb-4">
            <h4 className="font-medium text-gray-900 mb-3">Payment Breakdown:</h4>
            <div className="space-y-2">
              {receiptData.students.map((student: any, index: number) => (
                <div key={index} className="flex justify-between text-sm">
                  <span className="text-gray-600">{student.name} ({student.class}):</span>
                  <span className="font-medium">₦{student.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t pt-3">
            <div className="flex justify-between text-lg">
              <span className="text-gray-900 font-semibold">Total Amount Paid:</span>
              <span className="font-bold text-green-600">₦{receiptData.totalAmount.toLocaleString()}</span>
            </div>
          </div>
          
          <div className="flex justify-between mt-2">
            <span className="text-gray-600">Status:</span>
            <span className="font-medium text-green-600">{receiptData.status}</span>
          </div>
        </div>

        {/* Email Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start space-x-3">
            <div className="bg-blue-100 p-1 rounded-full">
              <CheckCircle className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-blue-800">Receipt Sent</h4>
              <p className="text-sm text-blue-700 mt-1">
                A digital receipt has been sent to your email and the school bursary office for all {receiptData.studentCount} students.
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex space-x-4">
          <button
            onClick={handleContinue}
            className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-4 rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
          >
            Continue to Dashboard
          </button>
          <button
            onClick={() => {
              // Try to get the receipt content
              const printContent = document.getElementById('bulk-payment-receipt');
              if (!printContent) {
                alert('Receipt content not found');
                return;
              }
              
              // Open a new window for printing
              const printWindow = window.open('', '_blank', 'width=800,height=600');
              if (!printWindow) {
                alert('Please allow popups to print the receipt');
                return;
              }
              
              const receiptHTML = `
                <!DOCTYPE html>
                <html>
                  <head>
                    <title>Bulk Payment Receipt</title>
                    <style>
                      body { 
                        font-family: Arial, sans-serif; 
                        margin: 20px; 
                        line-height: 1.6;
                      }
                      .receipt-header { 
                        text-align: center; 
                        margin-bottom: 30px; 
                        border-bottom: 2px solid #333;
                        padding-bottom: 20px;
                      }
                      .receipt-content { 
                        max-width: 600px; 
                        margin: 0 auto; 
                      }
                      .receipt-section { 
                        margin-bottom: 20px; 
                        padding: 15px;
                        background-color: #f9f9f9;
                        border-radius: 5px;
                      }
                      .receipt-row { 
                        display: flex; 
                        justify-content: space-between; 
                        margin-bottom: 8px; 
                        padding: 5px 0;
                      }
                      .receipt-total { 
                        border-top: 2px solid #000; 
                        padding-top: 15px; 
                        font-weight: bold; 
                        font-size: 1.2em;
                      }
                      .student-breakdown { 
                        margin: 15px 0; 
                        padding: 10px;
                        background-color: #fff;
                        border: 1px solid #ddd;
                        border-radius: 5px;
                      }
                      h3, h4 { 
                        color: #333; 
                        margin-bottom: 15px;
                        border-bottom: 1px solid #ddd;
                        padding-bottom: 5px;
                      }
                      @media print { 
                        body { margin: 0; }
                        .receipt-section { break-inside: avoid; }
                        .student-breakdown { break-inside: avoid; }
                      }
                    </style>
                  </head>
                  <body>
                    <div class="receipt-content">
                      <div class="receipt-header">
                        <h1>SchoolPay Bulk Payment Receipt</h1>
                        <p>Official Payment Confirmation</p>
                      </div>
                      ${printContent.innerHTML}
                    </div>
                  </body>
                </html>
              `;
              
              printWindow.document.write(receiptHTML);
              printWindow.document.close();
              
              // Wait for content to load then print
              printWindow.onload = function() {
                printWindow.print();
                printWindow.close();
              };
            }}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          >
            Print Receipt
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="bg-blue-100 p-2 rounded-lg">
          <Users className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Bulk Payment</h2>
          <p className="text-gray-600">Pay school fees for {students.length} students</p>
        </div>
      </div>

      {/* Students Summary */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <h3 className="font-medium text-gray-900 mb-3">Students to Pay For:</h3>
        <div className="space-y-2">
          {students.map((student) => (
            <div key={student.id} className="flex justify-between items-center text-sm">
              <div>
                <span className="font-medium">{student.name}</span>
                <span className="text-gray-500 ml-2">({student.class})</span>
              </div>
              <span className="font-medium text-green-600">
                ₦{(student.total_fees - student.amount_paid).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Payment Summary */}
      <div className="border rounded-lg p-4 mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-gray-600">Number of Students:</span>
          <span className="font-medium">{students.length}</span>
        </div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-gray-600">Session:</span>
          <span className="font-medium">{students[0]?.session}</span>
        </div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-gray-600">Term:</span>
          <span className="font-medium">{students[0]?.term}</span>
        </div>
        <div className="border-t pt-2">
          <div className="flex justify-between items-center">
            <span className="text-gray-900 font-semibold">Total Amount:</span>
            <span className="font-bold text-green-600 text-lg">₦{totalAmount.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Payment Form */}
      <form onSubmit={generatePaymentRRR} className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Payment Method */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-800 mb-2">Payment Method</h3>
          <div className="flex items-center space-x-2">
            <CreditCard className="h-5 w-5 text-blue-600" />
            <span className="text-sm text-blue-700">Credit/Debit Card via Remita</span>
          </div>
          <p className="text-xs text-blue-600 mt-1">
            Secure payment powered by Remita - Government approved payment platform
          </p>
        </div>

        {/* If no RRR yet, show generate RRR button */}
        {!rrr && (
          <button
            type="submit"
            disabled={loading || totalAmount <= 0}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-4 rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {loading ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Generating payment reference...</span>
              </div>
            ) : (
              `Generate Payment Reference for ₦${totalAmount.toLocaleString()}`
            )}
          </button>
        )}
        
        {/* If RRR is generated but payment not initiated, show RRR and payment button */}
        {rrr && paymentStage === 'rrr_generated' && !loading && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-600">Payment Reference (RRR):</p>
                  <p className="text-lg font-medium">{rrr}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Amount:</p>
                  <p className="text-lg font-bold">₦{totalAmount.toLocaleString()}</p>
                </div>
              </div>
            </div>
            
            <button
              type="button"
              onClick={initiateRemitaPayment}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-4 rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
            >
              Pay via Remita
            </button>
          </div>
        )}
        
        {/* Show verification in progress */}
        {paymentStage === 'processing' && (
          <div className="flex items-center justify-center space-x-2 w-full bg-blue-100 text-blue-800 py-3 px-4 rounded-lg">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <span>Waiting for payment verification...</span>
          </div>
        )}
        
        {/* Manual verification button (shows only when RRR exists and payment was initiated but not complete) */}
        {rrr && paymentStage !== 'complete' && !loading && paymentStage !== 'initial' && paymentStage !== 'rrr_generated' && (
          <button
            type="button"
            onClick={verifyPaymentManually}
            className="mt-3 w-full border border-blue-500 text-blue-600 py-2 px-4 rounded-lg font-medium hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
          >
            Verify Payment Status
          </button>
        )}

        {/* Demo Notice */}
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-yellow-800">Demo Mode</h4>
              <p className="text-sm text-yellow-700 mt-1">
                This is a demonstration using Remita test environment. A test payment interface will be shown where you can complete the payment process.
              </p>
            </div>
          </div>
        </div>
      </form>

      {/* Payment Features Info */}
      <div className="mt-6 bg-gray-50 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Bulk Payment Features</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-600">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span>Single transaction for multiple students</span>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span>Consolidated receipt generation</span>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span>Email notifications for all students</span>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span>Automatic status updates</span>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span>Secure payment processing</span>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span>Detailed transaction history</span>
          </div>
        </div>
      </div>
    </div>
  );
}