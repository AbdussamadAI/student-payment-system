import React, { useState, useEffect } from 'react';
import { Student } from '../types';
import { CreditCard, AlertCircle, CheckCircle, Loader2, Download, Printer, ArrowRight } from 'lucide-react';
import { generateRRR, initRemitaPayment, verifyPayment } from '../services/remitaService';
import { globalMockPayments } from '../App';

interface PaymentFormProps {
  student: Student;
  onSuccess: (amount: number) => void;
  onCancel?: () => void;
}

export function PaymentForm({ student, onSuccess, onCancel }: PaymentFormProps) {
  const [amount, setAmount] = useState(student.total_fees - student.amount_paid);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [rrr, setRRR] = useState<string>('');
  const [paymentStage, setPaymentStage] = useState<'initial' | 'rrr_generated' | 'paying' | 'complete'>('initial');
  
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
  
  // Function to validate payment amount
  const validateAmount = () => {
    const remainingBalance = student.total_fees - student.amount_paid;
    if (amount <= 0) {
      setError('Amount must be greater than 0');
      return false;
    }
    if (amount > remainingBalance) {
      setError(`Amount cannot exceed the remaining balance of ₦${remainingBalance.toLocaleString()}`);
      return false;
    }
    return true;
  };
  
  // Function to generate Remita RRR
  const generatePaymentRRR = async () => {
    if (!validateAmount()) {
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // Generate RRR using remitaService
      const response = await generateRRR({
        amount: amount,
        payerName: student.name,
        payerEmail: student.email || 'student@schoolpay.com',
        payerPhone: student.phone || '08012345678',
        description: `School fees payment for ${student.name}, Class: ${student.class}, Term: ${student.term}`
      });
      
      if (response.RRR) {
        console.log('RRR generated successfully:', response.RRR);
        setRRR(response.RRR);
        setPaymentStage('rrr_generated');
      } else {
        setError(response.message || 'Failed to generate payment reference. Please try again.');
      }
    } catch (err) {
      console.error('Error generating RRR:', err);
      setError('An error occurred while setting up payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Function to handle the initial payment form submission
  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    await generatePaymentRRR();
  };
  
  // Function to initiate Remita payment with generated RRR
  const initiateRemitaPayment = () => {
    setPaymentStage('paying');
    
    // Initialize Remita payment widget using JavaScript SDK
    initRemitaPayment(
      rrr,
      // On success callback
      (response: any) => {
        console.log('Payment successful:', response);
        
        // In production, you'd want to verify the payment status from your server
        verifyPaymentStatus(rrr);
      },
      // On error callback
      (response: any) => {
        console.error('Payment failed:', response);
        setError(response.message || 'Payment failed. Please try again.');
        setPaymentStage('rrr_generated');
      },
      // On close callback
      () => {
        console.log('Payment widget closed');
        // Always revert to RRR generated state when widget is closed
        // This ensures cancellation is properly handled
        setPaymentStage('rrr_generated');
        setLoading(false);
      }
    );
  };
  
  // Function to verify payment status from server
  const verifyPaymentStatus = async (rrr: string) => {
    try {
      setLoading(true);
      const response = await verifyPayment(rrr);
      
      if (response.status === '00' || response.status === '01') {
        // Payment successful
        const currentDate = new Date();
        const receipt = {
          transactionId: rrr,
          amount,
          studentName: student.name,
          class: student.class,
          session: student.session,
          term: student.term,
          paymentDate: currentDate.toLocaleDateString(),
          paymentTime: currentDate.toLocaleTimeString(),
          paymentMethod: 'Remita',
          status: 'Completed',
          // Add additional receipt information from response if available
          paymentReference: response.paymentReference || rrr,
          payerEmail: student.email || 'student@schoolpay.com',
          schoolName: 'School Name Academy',
          receiptNumber: `RCP-${Date.now().toString().slice(-8)}`
        };
        
        // Generate receipt HTML for download URL
        const receiptHTML = generateReceiptHTML(receipt);
        const receiptBlob = new Blob([receiptHTML], { type: 'text/html' });
        const receiptUrl = URL.createObjectURL(receiptBlob);
        
        // Create a new payment record and add it to globalMockPayments
        const newPayment = {
          id: `pay-${Date.now()}`,
          student_id: student.id,
          payer_id: student.parent_id || student.user_id || 'self-payment',
          amount: amount,
          payment_method: 'Remita',
          transaction_id: rrr,
          session: student.session,
          term: student.term,
          status: 'completed',
          receipt_url: receiptUrl,
          created_at: currentDate.toISOString()
        };
        
        // Add the new payment to the global payments array
        globalMockPayments.unshift(newPayment);
        
        setReceiptData(receipt);
        setSuccess(true);
        setPaymentStage('complete');
        
        // We no longer immediately call onSuccess here
        // This allows the user to stay on the receipt page
        // onSuccess will only be called when they click "Continue to Dashboard"
      } else if (response.status === '021') {
        // Payment pending
        setError('Your payment is pending. It will be confirmed shortly.');
      } else {
        // Payment failed
        setError('Payment verification failed. Please contact support with your RRR: ' + rrr);
      }
    } catch (err) {
      console.error('Error verifying payment:', err);
      setError('Failed to verify payment status. Please contact support with your RRR: ' + rrr);
    } finally {
      setLoading(false);
    }
  };
  
  // Function to handle continue to dashboard
  const handleContinue = () => {
    if (onSuccess) {
      onSuccess(amount);
    }
  };
  
  // Function to handle cancel payment
  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
  };
  
  // No reference needed as we generate the receipt content dynamically
  
  // Function to generate receipt HTML
  const generateReceiptHTML = (data: any = null) => {
    const receipt = data || receiptData;
    if (!receipt) return '';
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payment Receipt - ${receipt.receiptNumber}</title>
          <meta charset="UTF-8">
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 20px; 
              line-height: 1.6;
              color: #333;
            }
            .receipt-header { 
              text-align: center; 
              margin-bottom: 30px; 
              border-bottom: 2px solid #333;
              padding-bottom: 20px;
            }
            .receipt-logo {
              max-width: 150px;
              margin-bottom: 15px;
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
              border: 1px solid #eee;
            }
            .receipt-row { 
              display: flex; 
              justify-content: space-between; 
              margin-bottom: 8px; 
              padding: 5px 0;
              border-bottom: 1px dotted #eaeaea;
            }
            .receipt-total { 
              border-top: 2px solid #000; 
              padding-top: 15px; 
              font-weight: bold; 
              font-size: 1.2em;
            }
            .verified-badge {
              color: #28a745;
              font-weight: bold;
              display: inline-block;
              border: 1px solid #28a745;
              border-radius: 3px;
              padding: 2px 8px;
              margin-left: 10px;
              font-size: 0.8em;
            }
            h3 { 
              color: #333; 
              margin-bottom: 15px;
              border-bottom: 1px solid #ddd;
              padding-bottom: 5px;
            }
            .footer {
              text-align: center;
              font-size: 0.8em;
              color: #666;
              margin-top: 40px;
              border-top: 1px solid #eee;
              padding-top: 20px;
            }
            @media print { 
              body { margin: 0; }
              .receipt-section { break-inside: avoid; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="receipt-content">
            <div class="receipt-header">
              <h1>${receipt.schoolName}</h1>
              <h2>Payment Receipt</h2>
              <p><strong>Receipt Number:</strong> ${receipt.receiptNumber}</p>
            </div>
            
            <div class="receipt-section">
              <h3>Payment Details</h3>
              <div class="receipt-row">
                <span>Transaction ID:</span>
                <span>${receipt.transactionId}</span>
              </div>
              <div class="receipt-row">
                <span>Payment Date:</span>
                <span>${receipt.paymentDate}</span>
              </div>
              <div class="receipt-row">
                <span>Payment Time:</span>
                <span>${receipt.paymentTime}</span>
              </div>
              <div class="receipt-row">
                <span>Payment Method:</span>
                <span>${receipt.paymentMethod}</span>
              </div>
              <div class="receipt-row">
                <span>Status:</span>
                <span style="color: #28a745;">${receipt.status} <span class="verified-badge">✓ Verified</span></span>
              </div>
            </div>
            
            <div class="receipt-section">
              <h3>Student Information</h3>
              <div class="receipt-row">
                <span>Student Name:</span>
                <span>${receipt.studentName}</span>
              </div>
              <div class="receipt-row">
                <span>Class:</span>
                <span>${receipt.class}</span>
              </div>
              <div class="receipt-row">
                <span>Session:</span>
                <span>${receipt.session}</span>
              </div>
              <div class="receipt-row">
                <span>Term:</span>
                <span>${receipt.term}</span>
              </div>
            </div>
            
            <div class="receipt-section">
              <h3>Payment Summary</h3>
              <div class="receipt-total">
                <span>Amount Paid:</span>
                <span>₦${receipt.amount.toLocaleString()}</span>
              </div>
            </div>
            
            <div class="footer">
              <p>This is an electronically generated receipt and does not require a physical signature.</p>
              <p>If you have any questions, please contact the school administration office.</p>
              <p>Thank you for your payment!</p>
            </div>
          </div>
        </body>
      </html>
    `;
  };

  // Function to print receipt
  const printReceipt = () => {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      alert('Please allow popups to print the receipt');
      return;
    }

    const receiptHTML = generateReceiptHTML();
    printWindow.document.write(receiptHTML);
    printWindow.document.close();

    // Wait for content to load then print
    printWindow.onload = function() {
      printWindow.print();
      // Don't close the window after printing so user can see the print preview
    };
  };
  
  // Function to download receipt as HTML
  const downloadReceipt = () => {
    if (!receiptData) return;
    
    // Create a hidden link element
    const element = document.createElement('a');
    
    // Set the file name with receipt number and date
    const fileName = `Payment_Receipt_${receiptData.receiptNumber || Date.now()}.html`;
    
    // Create a blob from the receipt HTML content
    const receiptHTML = generateReceiptHTML();
    const blob = new Blob([receiptHTML], { type: 'text/html' });
    
    // Create a URL for the blob
    const url = URL.createObjectURL(blob);
    
    // Set the link attributes
    element.href = url;
    element.download = fileName;
    
    // Append to the document, click and remove
    document.body.appendChild(element);
    element.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(element);
      URL.revokeObjectURL(url);
    }, 100);
  };

  // Show receipt if payment is successful
  if (success && receiptData) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center mb-6">
          <div className="bg-green-100 rounded-full p-3">
            <CheckCircle className="h-12 w-12 text-green-500" />
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-center text-green-600 mb-6">Payment Successful!</h2>
        
        {/* Receipt */}
        <div id="payment-receipt" className="bg-gray-50 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">Payment Receipt</h3>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Transaction ID:</span>
              <span className="font-medium">{receiptData.transactionId}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">Student Name:</span>
              <span className="font-medium">{receiptData.studentName}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">Class:</span>
              <span className="font-medium">{receiptData.class}</span>
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
            
            <div className="flex justify-between">
              <span className="text-gray-600">Status:</span>
              <span className="font-medium text-green-600">{receiptData.status}</span>
            </div>
            
            <div className="flex justify-between border-t border-gray-200 pt-3 mt-3">
              <span className="text-gray-800 font-semibold">Amount Paid:</span>
              <span className="font-bold text-lg">₦{receiptData.amount.toLocaleString()}</span>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-4">
          <button
            onClick={downloadReceipt}
            className="flex items-center justify-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors"
          >
            <Download className="w-4 h-4 mr-2" />
            Download Receipt
          </button>
          <button
            onClick={printReceipt}
            className="flex items-center justify-center px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          >
            <Printer className="w-4 h-4 mr-2" />
            Print Receipt
          </button>
          <button
            onClick={handleContinue}
            className="flex items-center justify-center px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
          >
            Continue
            <ArrowRight className="w-4 h-4 ml-2" />
          </button>
        </div>
      </div>
    );
  }

  // Calculate remaining balance
  const remainingBalance = student.total_fees - student.amount_paid;

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-bold mb-6">Make Payment</h2>
      
      <div className="mb-4 p-4 bg-blue-50 rounded-md">
        <div className="flex justify-between mb-2">
          <span className="text-sm text-gray-600">Total School Fees:</span>
          <span className="font-medium">₦{student.total_fees.toLocaleString()}</span>
        </div>
        <div className="flex justify-between mb-2">
          <span className="text-sm text-gray-600">Amount Paid:</span>
          <span className="font-medium">₦{student.amount_paid.toLocaleString()}</span>
        </div>
        <div className="flex justify-between font-semibold">
          <span className="text-gray-800">Remaining Balance:</span>
          <span className="text-blue-700">₦{remainingBalance.toLocaleString()}</span>
        </div>
      </div>
      
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-md flex items-start">
          <AlertCircle className="text-red-500 w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <form onSubmit={handlePayment}>
        <div className="mb-4">
          <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
            Payment Amount (₦)
          </label>
          <input
            type="number"
            id="amount"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            min="1"
            max={remainingBalance}
            className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading || paymentStage !== 'initial'}
          />
          <p className="text-xs text-gray-500 mt-1">
            Maximum amount: ₦{remainingBalance.toLocaleString()}
          </p>
        </div>
        
        <div className="mb-6">
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
            <label htmlFor="card" className="text-sm text-blue-700">Credit/Debit Card</label>
          </div>
          <p className="text-xs text-blue-600 mt-1">Secure payment powered by Remita</p>
          <p className="text-xs text-gray-500 mt-1">(Implementing the complete Remita payment process)</p>
        </div>

        {/* Payment action buttons based on stage */}
        <div className="flex space-x-3 mt-3">
          {paymentStage === 'initial' && (
            <button
              type="submit"
              className={`flex items-center justify-center w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${loading ? 'opacity-75 cursor-not-allowed' : ''}`}
              disabled={loading || amount <= 0 || amount > remainingBalance}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  <span>Generating RRR...</span>
                </>
              ) : (
                'Generate Payment Reference'
              )}
            </button>
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
                type="button"
                onClick={initiateRemitaPayment}
                className="flex items-center justify-center w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Pay Now with Remita
              </button>
            </div>
          )}
          
          {paymentStage === 'paying' && (
            <div className="w-full text-center py-4">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
              <p className="text-sm text-gray-600 mt-2">Processing your payment...</p>
            </div>
          )}
        </div>
        
        {/* Cancel button */}
        {paymentStage === 'initial' && (
          <div className="mt-4 text-center">
            <button 
              type="button" 
              onClick={handleCancel}
              className="text-gray-500 hover:text-gray-700 text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
