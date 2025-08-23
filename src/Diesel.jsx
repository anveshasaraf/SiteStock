import React, { useState, useEffect } from 'react';
import { Package, Truck, BarChart3, AlertTriangle, CheckCircle, Plus, Minus, Download, Upload, ArrowLeft, Eye, X, FileText, Image, Trash2, Calendar } from 'lucide-react';
import { supabase } from './supabaseClient';

const SiteAwareDieselInventorySystem = ({ selectedSite, onBackToSites, currentUser = null }) => {

  // Check if current user is super admin
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const [inventory, setInventory] = useState({});
  const [incomingForm, setIncomingForm] = useState({
    totalWeight: '',
    weightUnit: 'litres',
    importedFrom: '',
    billFile: null,
    billFileName: ''
  });
  const [outgoingForm, setOutgoingForm] = useState({
    weight: '',
    weightUnit: 'litres',
    recipient: '',
    issueSlipFile: null,
    issueSlipFileName: ''
  });
  const [transactions, setTransactions] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [activeTab, setActiveTab] = useState('inventory');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  
  // File viewer state
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileViewerOpen, setFileViewerOpen] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);

  // Delete confirmation state
  const [deleteConfirmation, setDeleteConfirmation] = useState({
    isOpen: false,
    transaction: null,
    isDeleting: false
  });

  // Period filter state
  const [periodFilter, setPeriodFilter] = useState({
    type: 'last30days',
    startDate: '',
    endDate: ''
  });


  // Get filtered transactions based on period
  const getFilteredTransactions = () => {
    if (!periodFilter.type) {
      return transactions;
    }

    const now = new Date();
    let startDate = new Date();

    switch (periodFilter.type) {
      case 'last7days':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'last30days':
        startDate.setDate(now.getDate() - 30);
        break;
      case 'last90days':
        startDate.setDate(now.getDate() - 90);
        break;
      case 'lastYear':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      case 'custom':
        if (periodFilter.startDate && periodFilter.endDate) {
          startDate = new Date(periodFilter.startDate);
          const endDate = new Date(periodFilter.endDate);
          endDate.setHours(23, 59, 59, 999);
          return transactions.filter(t => {
            const timestampToUse = t.rawTimestamp || t.timestamp;
            const transactionDate = new Date(timestampToUse);
            
            if (isNaN(transactionDate.getTime())) {
              console.warn('Failed to parse transaction date:', timestampToUse);
              return true;
            }
            
            return transactionDate >= startDate && transactionDate <= endDate;
          });
        }
        return transactions;
      default:
        startDate.setDate(now.getDate() - 30);
    }

    return transactions.filter(t => {
      const timestampToUse = t.rawTimestamp || t.timestamp;
      const transactionDate = new Date(timestampToUse);
      
      if (isNaN(transactionDate.getTime())) {
        console.warn('Failed to parse transaction date:', timestampToUse);
        return true;
      }
      
      return transactionDate >= startDate;
    });
  };

  // Period selector component
  const PeriodSelector = () => (
    <div className="bg-gray-50 p-4 rounded-lg mb-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-gray-600" />
          <span className="text-sm font-medium text-gray-700">Period:</span>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {[
            { value: 'last7days', label: 'Last 7 Days' },
            { value: 'last30days', label: 'Last 30 Days' },
            { value: 'last90days', label: 'Last 90 Days' },
            { value: 'lastYear', label: 'Last Year' },
            { value: 'custom', label: 'Custom' }
          ].map(period => (
            <button
              key={period.value}
              onClick={() => setPeriodFilter(prev => ({ ...prev, type: period.value }))}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                periodFilter.type === period.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              {period.label}
            </button>
          ))}
        </div>

        {periodFilter.type === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={periodFilter.startDate}
              onChange={(e) => setPeriodFilter(prev => ({ ...prev, startDate: e.target.value }))}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={periodFilter.endDate}
              onChange={(e) => setPeriodFilter(prev => ({ ...prev, endDate: e.target.value }))}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        )}
      </div>
    </div>
  );


  // Get supplier summary
  const getSupplierSummary = () => {
    const filteredTransactions = getFilteredTransactions();
    const summary = {};
    
    filteredTransactions.forEach(transaction => {
      if (transaction.type === 'incoming' && transaction.importedFrom) {
        const supplier = transaction.importedFrom;
        
        if (!summary[supplier]) {
          summary[supplier] = {
            weight: 0,
            transactions: []
          };
        }
        
        summary[supplier].weight += transaction.weight;
        summary[supplier].transactions.push(transaction);
      }
    });
    
    return summary;
  };


  // Delete Confirmation Modal
  const DeleteConfirmationModal = () => {
    if (!deleteConfirmation.isOpen || !deleteConfirmation.transaction) return null;

    const transaction = deleteConfirmation.transaction;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg max-w-md w-full p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Delete Transaction</h3>
              <p className="text-sm text-gray-600">This action cannot be undone</p>
            </div>
          </div>

          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="text-sm space-y-1">
              <div><strong>Type:</strong> {transaction.type === 'incoming' ? 'Incoming' : 'Outgoing'}</div>
              <div><strong>Weight:</strong> {transaction.weight.toFixed(3)} {transaction.weightUnit}</div>
              <div><strong>Date:</strong> {transaction.timestamp}</div>
              {transaction.importedFrom && <div><strong>From:</strong> {transaction.importedFrom}</div>}
              {transaction.recipient && <div><strong>To:</strong> {transaction.recipient}</div>}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setDeleteConfirmation({ isOpen: false, transaction: null, isDeleting: false })}
              disabled={deleteConfirmation.isDeleting}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmDelete}
              disabled={deleteConfirmation.isDeleting}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {deleteConfirmation.isDeleting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 size={16} />
                  Delete
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Handle delete confirmation
  const handleConfirmDelete = async () => {
    if (!deleteConfirmation.transaction) return;

    setDeleteConfirmation(prev => ({ ...prev, isDeleting: true }));

    try {
      const transaction = deleteConfirmation.transaction;
      
      // Delete from database
      const { error: deleteError } = await supabase
        .from('diesel_transactions')
        .delete()
        .eq('id', transaction.id);

      if (deleteError) throw deleteError;

      // Update inventory based on transaction type
      const currentInventory = inventory.total || { totalWeight: 0 };
      
      let newTotalWeight;
      
      if (transaction.type === 'incoming') {
        // Removing an incoming transaction - subtract from inventory
        newTotalWeight = Math.max(0, currentInventory.totalWeight - transaction.weight);
      } else {
        // Removing an outgoing transaction - add back to inventory
        newTotalWeight = currentInventory.totalWeight + transaction.weight;
      }

      // Update inventory in database
      await updateInventoryInDB(newTotalWeight);

      // Update local state
      setInventory(prev => ({
        ...prev,
        total: {
          totalWeight: newTotalWeight
        }
      }));

      // Reload transactions
      await loadTransactionsData();

      addAlert(`Transaction deleted successfully. Inventory updated.`, 'success');
      
    } catch (error) {
      addAlert('Error deleting transaction: ' + error.message, 'error');
    } finally {
      setDeleteConfirmation({ isOpen: false, transaction: null, isDeleting: false });
    }
  };

  // Handle delete button click
  const handleDeleteTransaction = (transaction) => {
    setDeleteConfirmation({
      isOpen: true,
      transaction: transaction,
      isDeleting: false
    });
  };

  // File upload helper function
  const uploadFileToStorage = async (file, folder = 'bills') => {
    try {
      if (!file) return null;

      const fileExt = file.name.split('.').pop();
      const fileName = `${folder}/${selectedSite.site_code}_${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('construction-files')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Upload error:', error);
        throw error;
      }

      return {
        fileName: data.path,
        originalName: file.name,
        size: file.size,
        type: file.type
      };
    } catch (error) {
      addAlert('Error uploading file: ' + error.message, 'error');
      return null;
    }
  };

  // Get file URL from storage
  const getFileUrl = async (fileName) => {
    try {
      const { data, error } = await supabase.storage
        .from('construction-files')
        .createSignedUrl(fileName, 3600);

      if (error) throw error;
      return data.signedUrl;
    } catch (error) {
      console.error('Error getting file URL:', error);
      return null;
    }
  };

  // File viewer component
  const FileViewer = () => {
    const [fileUrl, setFileUrl] = useState(null);
    const [fileError, setFileError] = useState(false);

    useEffect(() => {
      if (selectedFile && fileViewerOpen) {
        setFileLoading(true);
        setFileError(false);
        
        getFileUrl(selectedFile.fileName)
          .then(url => {
            if (url) {
              setFileUrl(url);
            } else {
              setFileError(true);
            }
          })
          .catch(() => setFileError(true))
          .finally(() => setFileLoading(false));
      }
    }, [selectedFile, fileViewerOpen]);

    if (!fileViewerOpen || !selectedFile) return null;

    const isImage = selectedFile.originalName?.toLowerCase().match(/\.(jpg|jpeg|png|gif|bmp|webp)$/);
    const isPdf = selectedFile.originalName?.toLowerCase().endsWith('.pdf');

    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] w-full overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-2">
              {isImage ? <Image size={20} /> : <FileText size={20} />}
              <h3 className="font-semibold text-gray-900">
                {selectedFile.originalName || selectedFile.fileName}
              </h3>
            </div>
            <button
              onClick={() => {
                setFileViewerOpen(false);
                setSelectedFile(null);
                setFileUrl(null);
                setFileError(false);
              }}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-4 max-h-[calc(90vh-80px)] overflow-auto">
            {fileLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600">Loading file...</span>
              </div>
            )}

            {fileError && (
              <div className="text-center py-12">
                <AlertTriangle className="mx-auto h-12 w-12 text-red-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">File Not Found</h3>
                <p className="text-gray-600">The file could not be loaded. It may have been moved or deleted.</p>
              </div>
            )}

            {fileUrl && !fileLoading && !fileError && (
              <>
                {isImage && (
                  <div className="text-center">
                    <img 
                      src={fileUrl} 
                      alt={selectedFile.originalName}
                      className="max-w-full h-auto rounded-lg shadow-lg"
                      onError={() => setFileError(true)}
                    />
                  </div>
                )}

                {isPdf && (
                  <div className="w-full h-96">
                    <iframe
                      src={fileUrl}
                      className="w-full h-full border rounded-lg"
                      title={selectedFile.originalName}
                      onError={() => setFileError(true)}
                    />
                  </div>
                )}

                {!isImage && !isPdf && (
                  <div className="text-center py-12">
                    <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Preview Not Available</h3>
                    <p className="text-gray-600 mb-4">
                      This file type cannot be previewed in the browser.
                    </p>
                    <a
                      href={fileUrl}
                      download={selectedFile.originalName}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg inline-flex items-center gap-2"
                    >
                      <Download size={16} />
                      Download File
                    </a>
                  </div>
                )}

                {(isImage || isPdf) && (
                  <div className="text-center mt-4 pt-4 border-t">
                    <a
                      href={fileUrl}
                      download={selectedFile.originalName}
                      className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 text-sm"
                    >
                      <Download size={14} />
                      Download File
                    </a>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Handle file view
  const handleFileView = async (fileName, originalName) => {
    if (!fileName) {
      addAlert('File not found', 'error');
      return;
    }

    setSelectedFile({
      fileName: fileName,
      originalName: originalName || fileName
    });
    setFileViewerOpen(true);
  };

  // Add a function to export to Excel
  const exportToExcel = (filename) => {
    let csvContent = '';
    
    if (filename.includes('stock_summary')) {
      csvContent = `Site: ${selectedSite.site_name} (${selectedSite.site_code})\n`;
      csvContent += 'Particulars,Inwards Weight,Outwards Weight,Closing Weight\n';
      const filteredTransactions = getFilteredTransactions();
      const totalInwards = filteredTransactions
        .filter(t => t.type === 'incoming')
        .reduce((sum, t) => sum + t.weight, 0);
      const totalOutwards = filteredTransactions
        .filter(t => t.type === 'outgoing')
        .reduce((sum, t) => sum + t.weight, 0);
      const closingWeight = inventory.total?.totalWeight || 0;
      
      csvContent += `Diesel,${totalInwards.toFixed(3)},${totalOutwards.toFixed(3)},${closingWeight.toFixed(3)}\n`;
    } else if (filename.includes('contractor_summary')) {
      csvContent = `Site: ${selectedSite.site_name} (${selectedSite.site_code})\n`;
      csvContent += 'Contractor,Weight Issued\n';
      Object.entries(contractorSummary).forEach(([contractor, data]) => {
        csvContent += `${contractor},${data.weight.toFixed(3)}\n`;
      });
    } else if (filename.includes('supplier_summary')) {
      csvContent = `Site: ${selectedSite.site_name} (${selectedSite.site_code})\n`;
      csvContent += 'Supplier,Weight Received\n';
      Object.entries(supplierSummary).forEach(([supplier, data]) => {
        csvContent += `${supplier},${data.weight.toFixed(3)}\n`;
      });
    } else if (filename.includes('transactions')) {
      csvContent = `Site: ${selectedSite.site_name} (${selectedSite.site_code})\n`;
      csvContent += 'Date,Type,Weight,Imported From,Shipped To,Bill File,Issue Slip File\n';
      getFilteredTransactions().forEach(transaction => {
        csvContent += `${transaction.timestamp},${transaction.type},${transaction.weight.toFixed(3)},${transaction.importedFrom || ''},${transaction.recipient || ''},${transaction.billFileName || ''},${transaction.issueSlipFileName || ''}\n`;
      });
    }
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    addAlert(`Exported ${filename} successfully!`, 'success');
  };

  // Load data from Supabase on startup - FILTERED BY SITE
  useEffect(() => {
    if (selectedSite) {
      loadInventoryData();
      loadTransactionsData();
    }
  }, [selectedSite]);

  // Load inventory from database - SITE SPECIFIC
  const loadInventoryData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('diesel_inventory')
        .select('*')
        .eq('site_id', selectedSite.id);

      if (error) throw error;

      const inventoryData = data[0] || { total_weight: 0 };
      setInventory({
        total: {
          totalWeight: parseFloat(inventoryData.total_weight || 0)
        }
      });
    } catch (error) {
      addAlert('Error loading inventory: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Load transactions from database - SITE SPECIFIC
  const loadTransactionsData = async () => {
    try {
      const { data, error } = await supabase
        .from('diesel_transactions')
        .select('*')
        .eq('site_id', selectedSite.id)
        .order('timestamp', { ascending: false });

      if (error) throw error;

      const formattedTransactions = data.map((transaction, index) => ({
        id: transaction.id,
        uniqueKey: `${transaction.id}-${index}`,
        type: transaction.type,
        weight: parseFloat(transaction.weight),
        weightUnit: transaction.weight_unit,
        timestamp: new Date(transaction.timestamp).toLocaleString(),
        rawTimestamp: transaction.timestamp,
        recipient: transaction.recipient,
        importedFrom: transaction.imported_from,
        billFileName: transaction.bill_file_name,
        billFileOriginalName: transaction.bill_file_original_name,
        issueSlipFileName: transaction.issue_slip_file_name,
        issueSlipFileOriginalName: transaction.issue_slip_file_original_name
      }));

      setTransactions(formattedTransactions);
    } catch (error) {
      addAlert('Error loading transactions: ' + error.message, 'error');
    }
  };

  // Update inventory in database - SITE SPECIFIC
  const updateInventoryInDB = async (totalWeight) => {
    try {
      const { error } = await supabase
        .from('diesel_inventory')
        .upsert({
          site_id: selectedSite.id,
          total_weight: parseFloat(totalWeight),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'site_id'
        });

      if (error) throw error;
    } catch (error) {
      addAlert('Error updating inventory: ' + error.message, 'error');
    }
  };

  // Save transaction to database - SITE SPECIFIC
  const saveTransactionToDB = async (transaction) => {
    try {
      const { error } = await supabase
        .from('diesel_transactions')
        .insert([{
          type: transaction.type,
          weight: transaction.weight,
          weight_unit: transaction.weightUnit,
          recipient: transaction.recipient || null,
          imported_from: transaction.importedFrom || null,
          bill_file_name: transaction.billFileName || null,
          bill_file_original_name: transaction.billFileOriginalName || null,
          issue_slip_file_name: transaction.issueSlipFileName || null,
          issue_slip_file_original_name: transaction.issueSlipFileOriginalName || null,
          site_id: selectedSite.id
        }]);

      if (error) throw error;
    } catch (error) {
      addAlert('Error saving transaction: ' + error.message, 'error');
    }
  };

  // Handle file upload for incoming bills
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        addAlert('File size must be less than 10MB', 'error');
        return;
      }
      
      setIncomingForm(prev => ({ 
        ...prev, 
        billFile: file,
        billFileName: file.name 
      }));
    }
  };

  // Handle file upload for outgoing issue slips
  const handleIssueSlipUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        addAlert('File size must be less than 10MB', 'error');
        return;
      }
      
      setOutgoingForm(prev => ({ 
        ...prev, 
        issueSlipFile: file,
        issueSlipFileName: file.name 
      }));
    }
  };

  // Add alert
  const addAlert = (message, type) => {
    const alert = { id: Date.now(), message, type };
    setAlerts(prev => [alert, ...prev.slice(0, 4)]);
    setTimeout(() => {
      setAlerts(prev => prev.filter(a => a.id !== alert.id));
    }, 5000);
  };

  // Handle incoming shipment
  const handleIncomingShipment = async () => {
    const { totalWeight, weightUnit, importedFrom, billFile, billFileName } = incomingForm;
    
    if (!totalWeight || !importedFrom.trim()) {
      addAlert('Please fill all required fields including supplier/vendor information', 'error');
      return;
    }

    setUploading(true);

    try {
      let fileInfo = null;
      if (billFile) {
        fileInfo = await uploadFileToStorage(billFile, 'bills');
        if (!fileInfo) {
          addAlert('File upload failed, but transaction will be saved without file', 'warning');
        }
      }

      const weightInLitres = weightUnit === 'litres' ? parseFloat(totalWeight) : parseFloat(totalWeight);
      
      const newTotalWeight = (inventory.total?.totalWeight || 0) + weightInLitres;
      
      setInventory(prev => ({
        ...prev,
        total: {
          totalWeight: newTotalWeight
        }
      }));

      await updateInventoryInDB(newTotalWeight);
      
      const transaction = {
        type: 'incoming',
        weight: weightInLitres,
        weightUnit,
        importedFrom: importedFrom.trim(),
        billFileName: fileInfo?.fileName || null,
        billFileOriginalName: fileInfo?.originalName || billFileName || null
      };

      await saveTransactionToDB(transaction);
      await loadTransactionsData();
      
      addAlert(`Added ${weightInLitres.toFixed(3)} ${weightUnit} of diesel to ${selectedSite.site_name} from ${importedFrom.trim()}`, 'success');

      setIncomingForm({ 
        totalWeight: '', 
        weightUnit: 'litres',
        importedFrom: '',
        billFile: null, 
        billFileName: '' 
      });
    } catch (error) {
      addAlert('Error processing shipment: ' + error.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  // Handle outgoing shipment
  const handleOutgoingShipment = async () => {
    const { weight, weightUnit, recipient, issueSlipFile, issueSlipFileName } = outgoingForm;
    
    if (!weight || !recipient.trim()) {
      addAlert('Please fill all required fields including recipient', 'error');
      return;
    }

    const requestedWeight = parseFloat(weight);
    const currentStock = inventory.total?.totalWeight || 0;

    if (requestedWeight > currentStock) {
      addAlert(`Insufficient stock at ${selectedSite.site_name}! Available: ${currentStock.toFixed(3)} ${weightUnit}, Requested: ${requestedWeight.toFixed(3)} ${weightUnit}`, 'error');
      return;
    }

    setUploading(true);

    try {
      let fileInfo = null;
      if (issueSlipFile) {
        fileInfo = await uploadFileToStorage(issueSlipFile, 'issue-slips');
        if (!fileInfo) {
          addAlert('File upload failed, but transaction will be saved without file', 'warning');
        }
      }

      const newTotalWeight = currentStock - requestedWeight;
      
      setInventory(prev => ({
        ...prev,
        total: {
          totalWeight: newTotalWeight
        }
      }));

      await updateInventoryInDB(newTotalWeight);

      const transaction = {
        type: 'outgoing',
        weight: requestedWeight,
        weightUnit,
        recipient: recipient.trim(),
        issueSlipFileName: fileInfo?.fileName || null,
        issueSlipFileOriginalName: fileInfo?.originalName || issueSlipFileName || null
      };

      await saveTransactionToDB(transaction);
      await loadTransactionsData();
      
      addAlert(`Shipped ${requestedWeight.toFixed(3)} ${weightUnit} of diesel from ${selectedSite.site_name} to ${recipient.trim()}`, 'success');
      
      setOutgoingForm({ 
        weight: '', 
        weightUnit: 'litres', 
        recipient: '', 
        issueSlipFile: null, 
        issueSlipFileName: '' 
      });
    } catch (error) {
      addAlert('Error processing shipment: ' + error.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  // Get contractor-wise summary
  const getContractorSummary = () => {
    const filteredTransactions = getFilteredTransactions();
    const summary = {};
    
    filteredTransactions.forEach(transaction => {
      if (transaction.type === 'outgoing' && transaction.recipient) {
        const contractor = transaction.recipient;
        
        if (!summary[contractor]) {
          summary[contractor] = {
            weight: 0,
            transactions: []
          };
        }
        
        summary[contractor].weight += transaction.weight;
        summary[contractor].transactions.push(transaction);
      }
    });
    
    return summary;
  };

  // Get totals for summary
  const getTotals = () => {
    const filteredTransactions = getFilteredTransactions();
    const currentStock = inventory.total?.totalWeight || 0;
    const totalIncoming = filteredTransactions
      .filter(t => t.type === 'incoming')
      .reduce((sum, t) => sum + t.weight, 0);
    const totalOutgoing = filteredTransactions
      .filter(t => t.type === 'outgoing')
      .reduce((sum, t) => sum + t.weight, 0);
    
    return {
      currentStock,
      totalIncoming,
      totalOutgoing
    };
  };

  // Get low stock status using site-specific threshold
  const isLowStock = () => {
    const threshold = selectedSite?.diesel_low_stock_threshold || 100;
    const currentStock = inventory.total?.totalWeight || 0;
    return currentStock < threshold;
  };

  const contractorSummary = getContractorSummary();
  const supplierSummary = getSupplierSummary();
  const totals = getTotals();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading diesel inventory data for {selectedSite?.site_name}...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 bg-gray-50 min-h-screen">
      <FileViewer />
      <DeleteConfirmationModal />

      {/* Site Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={onBackToSites}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
          >
            <ArrowLeft size={20} />
            Back to Sites
          </button>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">⛽ Diesel Inventory</h1>
              <p className="text-lg text-blue-600 font-medium">{selectedSite.site_name} ({selectedSite.site_code})</p>
            </div>
            <div className="text-right">
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 text-sm text-gray-600">
                <span>Total Stock: {totals.currentStock.toFixed(3)} litres</span>
                <span className={isLowStock() ? 'text-red-600 font-semibold' : ''}>
                  {isLowStock() ? '⚠ Low Stock' : '✓ Good Stock'}
                </span>
              </div>
              <span className="text-green-600 text-sm">🔄 Live Database</span>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      <div className="fixed top-4 right-4 z-40 space-y-2">
        {alerts.map((alert, index) => (
          <div key={`alert-${alert.id}-${index}`} className={`p-3 rounded-lg shadow-lg max-w-sm ${
            alert.type === 'success' ? 'bg-green-500 text-white' :
            alert.type === 'error' ? 'bg-red-500 text-white' :
            'bg-yellow-500 text-white'
          }`}>
            <div className="flex items-center gap-2">
              {alert.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
              <span className="text-sm">{alert.message}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white rounded-lg shadow mb-4 sm:mb-6">
        <div className="flex border-b overflow-x-auto">
          {[
            { id: 'inventory', label: 'Inventory', fullLabel: 'Current Inventory', icon: Package },
            { id: 'summary', label: 'Summary', fullLabel: 'Stock Summary', icon: BarChart3 },
            { id: 'incoming', label: 'Incoming', fullLabel: 'Incoming Shipment', icon: Upload },
            { id: 'outgoing', label: 'Outgoing', fullLabel: 'Outgoing Shipment', icon: Download },
            { id: 'transactions', label: 'History', fullLabel: 'Transaction History', icon: Truck }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 font-medium whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'border-b-2 border-blue-500 text-blue-600' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon size={18} />
              <span className="hidden sm:inline">{tab.fullLabel}</span>
              <span className="sm:hidden">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Inventory Tab */}
      {activeTab === 'inventory' && (
        <div className="space-y-6">
          {/* Low stock warning */}
          {isLowStock() && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="text-red-500" size={20} />
                <h3 className="font-semibold text-red-700">Low Stock Alert</h3>
              </div>
              <div className="text-sm text-red-600">
                Current stock is below the threshold of {selectedSite?.diesel_low_stock_threshold || 100} litres.
              </div>
            </div>
          )}

          {/* Inventory Card */}
          <div className="grid grid-cols-1 gap-4">
            <div className={`bg-white rounded-lg shadow-md p-4 sm:p-6 border-l-4 ${
              isLowStock() ? 'border-red-500' : 'border-green-500'
            }`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Diesel Fuel</h3>
                </div>
                {isLowStock() && <AlertTriangle className="text-red-500" size={16} />}
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600 text-sm sm:text-base">Total Stock:</span>
                  <span className="font-medium">{totals.currentStock.toFixed(3)} litres</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Unit:</span>
                  <span>Litres</span>
                </div>
                {isLowStock() && (
                  <div className="text-xs text-red-600 mt-2 pt-2 border-t border-red-200">
                    ⚠ Low stock alert (below {selectedSite?.diesel_low_stock_threshold || 100} litres)
                  </div>
                )}
              </div>
            </div>
          </div>

          {totals.currentStock === 0 && (
            <div className="text-center py-12">
              <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No diesel inventory at this site</h3>
              <p className="text-gray-600 mb-4">
                Start by adding your first diesel shipment to {selectedSite.site_name}.
              </p>
              <button
                onClick={() => setActiveTab('incoming')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 mx-auto"
              >
                <Plus size={16} />
                Add Diesel Shipment
              </button>
            </div>
          )}
        </div>
      )}

      {/* Summary Tab */}
      {activeTab === 'summary' && (
        <div className="space-y-6">
          <PeriodSelector />

          {/* Stock Summary */}
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2">
                <BarChart3 className="text-blue-600" size={24} />
                Stock Summary - Diesel at {selectedSite.site_name}
              </h2>
              <button
                onClick={() => exportToExcel(`diesel_stock_summary_${selectedSite.site_code}.csv`)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2"
              >
                <Download size={16} />
                <span className="hidden sm:inline">Export Excel</span>
                <span className="sm:hidden">Export</span>
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-blue-50">
                    <th className="border border-gray-300 text-left py-3 px-4 font-semibold">Particulars</th>
                    <th className="border border-gray-300 text-center py-3 px-4 font-semibold">Inwards (litres)</th>
                    <th className="border border-gray-300 text-center py-3 px-4 font-semibold">Outwards (litres)</th>
                    <th className="border border-gray-300 text-center py-3 px-4 font-semibold">Closing Balance (litres)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="hover:bg-blue-50 transition-colors">
                    <td className="border border-gray-300 py-4 px-4 font-medium text-blue-600">
                      Diesel Fuel
                      {isLowStock() && (
                        <span className="block mt-1 text-red-500 text-xs">⚠ Low Stock (below {selectedSite?.diesel_low_stock_threshold || 100})</span>
                      )}
                    </td>
                    <td className="border border-gray-300 py-4 px-4 text-center">{totals.totalIncoming.toFixed(3)}</td>
                    <td className="border border-gray-300 py-4 px-4 text-center">{totals.totalOutgoing.toFixed(3)}</td>
                    <td className="border border-gray-300 py-4 px-4 text-center">
                      <span className={isLowStock() ? 'text-red-600 font-semibold' : 'font-semibold'}>
                        {totals.currentStock.toFixed(3)}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Supplier Summary */}
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2">
                <Upload className="text-purple-600" size={24} />
                Supplier Inwards to {selectedSite.site_name}
              </h2>
              {Object.keys(supplierSummary).length > 0 && (
                <button
                  onClick={() => exportToExcel(`diesel_supplier_summary_${selectedSite.site_code}.csv`)}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2"
                >
                  <Download size={16} />
                  <span className="hidden sm:inline">Export Excel</span>
                  <span className="sm:hidden">Export</span>
                </button>
              )}
            </div>
            {Object.keys(supplierSummary).length === 0 ? (
              <p className="text-gray-500 text-center py-8">No supplier deliveries recorded for this period</p>
            ) : (
              <div className="space-y-4">
                {Object.entries(supplierSummary).map(([supplier, data], supplierIndex) => (
                  <div key={`supplier-${supplier}-${supplierIndex}`} className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-semibold text-lg mb-3 text-purple-700">{supplier}</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-2 px-2 font-medium text-gray-600">Weight Received (litres)</th>
                            <th className="text-left py-2 px-2 font-medium text-gray-600">Deliveries</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-gray-100">
                            <td className="py-2 px-2">{data.weight.toFixed(3)}</td>
                            <td className="py-2 px-2">{data.transactions.length}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Contractor Summary */}
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2">
                <Truck className="text-green-600" size={24} />
                Contractor Issues from {selectedSite.site_name}
              </h2>
              {Object.keys(contractorSummary).length > 0 && (
                <button
                  onClick={() => exportToExcel(`diesel_contractor_summary_${selectedSite.site_code}.csv`)}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2"
                >
                  <Download size={16} />
                  <span className="hidden sm:inline">Export Excel</span>
                  <span className="sm:hidden">Export</span>
                </button>
              )}
            </div>
            {Object.keys(contractorSummary).length === 0 ? (
              <p className="text-gray-500 text-center py-8">No contractor issues recorded for this period</p>
            ) : (
              <div className="space-y-4">
                {Object.entries(contractorSummary).map(([contractor, data], contractorIndex) => (
                  <div key={`contractor-${contractor}-${contractorIndex}`} className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-semibold text-lg mb-3 text-blue-700">{contractor}</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-2 px-2 font-medium text-gray-600">Weight Issued (litres)</th>
                            <th className="text-left py-2 px-2 font-medium text-gray-600">Issues</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-gray-100">
                            <td className="py-2 px-2">{data.weight.toFixed(3)}</td>
                            <td className="py-2 px-2">{data.transactions.length}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Incoming Shipment Tab */}
      {activeTab === 'incoming' && (
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4 sm:mb-6">
            <Upload className="text-green-600" size={24} />
            <h2 className="text-lg sm:text-xl font-semibold">Add Diesel to {selectedSite.site_name}</h2>
            {uploading && (
              <div className="flex items-center gap-2 text-blue-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-sm">Processing...</span>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-1 gap-4 mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Total Weight *
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.001"
                    value={incomingForm.totalWeight}
                    onChange={(e) => setIncomingForm(prev => ({ ...prev, totalWeight: e.target.value }))}
                    className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., 1000.500"
                    disabled={uploading}
                  />
                  <select
                    value={incomingForm.weightUnit}
                    onChange={(e) => setIncomingForm(prev => ({ ...prev, weightUnit: e.target.value }))}
                    className="w-24 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={uploading}
                  >
                    <option value="litres">Litres</option>
                    <option value="kg">Kg</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Imported From (Supplier/Vendor) *
                </label>
                <input
                  type="text"
                  value={incomingForm.importedFrom}
                  onChange={(e) => setIncomingForm(prev => ({ ...prev, importedFrom: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., ABC Petroleum Suppliers"
                  disabled={uploading}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Attach Bill/Invoice (Max 10MB)
              </label>
              <input
                type="file"
                accept="image/*,.pdf,.doc,.docx"
                onChange={handleFileUpload}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                disabled={uploading}
              />
              {incomingForm.billFileName && (
                <p className="text-xs text-green-600 mt-1">✓ {incomingForm.billFileName}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Supported formats: Images (JPG, PNG), PDF, Word documents
              </p>
            </div>
          </div>

          {/* Preview */}
          {incomingForm.totalWeight && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-blue-800 mb-2">Shipment Preview:</h3>
              <div className="text-sm text-blue-700">
                Weight: {parseFloat(incomingForm.totalWeight || 0).toFixed(3)} {incomingForm.weightUnit}
              </div>
              <div className="text-sm text-blue-700">
                Site: {selectedSite.site_name}
                {incomingForm.importedFrom && ` | From: ${incomingForm.importedFrom}`}
              </div>
            </div>
          )}

          <button
            onClick={handleIncomingShipment}
            disabled={uploading}
            className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Processing...
              </>
            ) : (
              <>
                <Plus size={18} />
                Add to {selectedSite.site_name} Inventory
              </>
            )}
          </button>
        </div>
      )}

      {/* Outgoing Shipment Tab */}
      {activeTab === 'outgoing' && (
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4 sm:mb-6">
            <Download className="text-blue-600" size={24} />
            <h2 className="text-lg sm:text-xl font-semibold">Ship Diesel from {selectedSite.site_name}</h2>
            {uploading && (
              <div className="flex items-center gap-2 text-blue-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-sm">Processing...</span>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-1 gap-4 mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Weight *
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.001"
                    value={outgoingForm.weight}
                    onChange={(e) => setOutgoingForm(prev => ({ ...prev, weight: e.target.value }))}
                    className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., 100.000"
                    disabled={uploading}
                  />
                  <select
                    value={outgoingForm.weightUnit}
                    onChange={(e) => setOutgoingForm(prev => ({ ...prev, weightUnit: e.target.value }))}
                    className="w-24 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={uploading}
                  >
                    <option value="litres">Litres</option>
                    <option value="kg">Kg</option>
                  </select>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Available: {totals.currentStock.toFixed(3)} litres
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ship to (Contractor/Site) *
                </label>
                <input
                  type="text"
                  value={outgoingForm.recipient}
                  onChange={(e) => setOutgoingForm(prev => ({ ...prev, recipient: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., ABC Construction Co."
                  disabled={uploading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Attach Issue Slip (Max 10MB)
              </label>
              <input
                type="file"
                accept="image/*,.pdf,.doc,.docx"
                onChange={handleIssueSlipUpload}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                disabled={uploading}
              />
              {outgoingForm.issueSlipFileName && (
                <p className="text-xs text-green-600 mt-1">✓ {outgoingForm.issueSlipFileName}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Supported formats: Images (JPG, PNG), PDF, Word documents
              </p>
            </div>
          </div>

          {/* Preview */}
          {outgoingForm.weight && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-orange-800 mb-2">Shipment Preview:</h3>
              <div className="text-sm text-orange-700">
                Weight: {parseFloat(outgoingForm.weight || 0).toFixed(3)} {outgoingForm.weightUnit}
              </div>
              <div className="text-sm text-orange-700">
                From: {selectedSite.site_name} → To: {outgoingForm.recipient || 'Not specified'}
              </div>
              <div className="text-sm text-orange-700">
                Remaining stock: {(totals.currentStock - (parseFloat(outgoingForm.weight) || 0)).toFixed(3)} litres
              </div>
            </div>
          )}

          <button
            onClick={handleOutgoingShipment}
            disabled={uploading}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Processing...
              </>
            ) : (
              <>
                <Minus size={18} />
                Ship from {selectedSite.site_name}
              </>
            )}
          </button>
        </div>
      )}

      {/* Transactions Tab */}
      {activeTab === 'transactions' && (
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div className="flex items-center gap-2">
              <Truck className="text-purple-600" size={24} />
              <h2 className="text-lg sm:text-xl font-semibold">Diesel Transactions - {selectedSite.site_name}</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => exportToExcel(`diesel_transactions_${selectedSite.site_code}.csv`)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2"
              >
                <Download size={16} />
                <span className="hidden sm:inline">Export Excel</span>
                <span className="sm:hidden">Export</span>
              </button>
              <div className="text-sm text-gray-500">
                {getFilteredTransactions().length} transactions
              </div>
            </div>
          </div>

          <PeriodSelector />
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-2 font-medium text-gray-600">Date & Time</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-600">Type</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-600">Weight</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-600">Details</th>
                  {isSuperAdmin && (
                    <th className="text-left py-3 px-2 font-medium text-gray-600">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {getFilteredTransactions().map((transaction, index) => {
                  const uniqueKey = `transaction-${transaction.id || 'no-id'}-${transaction.type}-${index}-${transaction.timestamp?.replace(/[^0-9]/g, '') || Date.now()}`;
                  
                  return (
                    <tr key={uniqueKey} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-2 text-xs">{transaction.timestamp}</td>
                      <td className="py-3 px-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          transaction.type === 'incoming' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {transaction.type === 'incoming' ? <Plus size={10} /> : <Minus size={10} />}
                          {transaction.type === 'incoming' ? 'IN' : 'OUT'}
                        </span>
                      </td>
                      <td className="py-3 px-2">{transaction.weight.toFixed(3)} {transaction.weightUnit}</td>
                      <td className="py-3 px-2 text-xs">
                        {transaction.type === 'incoming' && transaction.importedFrom && (
                          <div className="font-medium text-green-700 mb-1">From: {transaction.importedFrom}</div>
                        )}
                        {transaction.type === 'outgoing' && transaction.recipient && (
                          <div className="font-medium text-blue-700 mb-1">To: {transaction.recipient}</div>
                        )}
                        
                        {transaction.billFileName && (
                          <div className="mb-1">
                            <button
                              onClick={() => handleFileView(transaction.billFileName, transaction.billFileOriginalName)}
                              className="text-green-600 hover:text-green-800 hover:underline flex items-center gap-1 cursor-pointer"
                              title="Click to view bill/invoice"
                            >
                              <Eye size={12} />
                              📄 {transaction.billFileOriginalName && transaction.billFileOriginalName.length > 15 
                                ? transaction.billFileOriginalName.substring(0, 15) + '...' 
                                : transaction.billFileOriginalName || 'Bill'}
                            </button>
                          </div>
                        )}
                        {transaction.issueSlipFileName && (
                          <div className="mb-1">
                            <button
                              onClick={() => handleFileView(transaction.issueSlipFileName, transaction.issueSlipFileOriginalName)}
                              className="text-orange-600 hover:text-orange-800 hover:underline flex items-center gap-1 cursor-pointer"
                              title="Click to view issue slip"
                            >
                              <Eye size={12} />
                              📋 {transaction.issueSlipFileOriginalName && transaction.issueSlipFileOriginalName.length > 15 
                                ? transaction.issueSlipFileOriginalName.substring(0, 15) + '...' 
                                : transaction.issueSlipFileOriginalName || 'Issue Slip'}
                            </button>
                          </div>
                        )}
                      </td>
                      {isSuperAdmin && (
                        <td className="py-3 px-2">
                          <button
                            onClick={() => handleDeleteTransaction(transaction)}
                            className="text-red-600 hover:text-red-800 hover:bg-red-50 p-1 rounded-lg transition-colors"
                            title="Delete transaction (Super Admin only)"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {getFilteredTransactions().length === 0 && (
                  <tr>
                    <td colSpan={isSuperAdmin ? "5" : "4"} className="py-8 text-center text-gray-500">
                      No diesel transactions recorded for the selected period at {selectedSite.site_name}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default SiteAwareDieselInventorySystem;