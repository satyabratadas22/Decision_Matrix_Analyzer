'use client'

import { useState, useEffect } from 'react'
import { 
  Button, 
  TextField, 
  Typography, 
  Paper, 
  Box, 
  Slider,
  List,
  ListItem,
  ListItemText,
  Alert,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Container,
  Card,
  CardContent,
  Avatar,
  useTheme,
  Divider,
  Switch
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import SaveIcon from '@mui/icons-material/Save'
import CalculateIcon from '@mui/icons-material/Calculate'
import AddCircleIcon from '@mui/icons-material/AddCircle'
import RemoveCircleIcon from '@mui/icons-material/RemoveCircle'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import HistoryIcon from '@mui/icons-material/History'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import { collection, addDoc, getDocs, doc, deleteDoc } from "firebase/firestore"
import { db } from "@/app/firebase"
import NoSSR from '@/app/NoSSR'
import { Bar, Pie } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js'

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
)

type Criteria = {
  id: number
  name: string
  percentage: number
  isBenefit: boolean
  min?: number
  max?: number
}

type Option = {
  id: number
  name: string
  values: {[key: string]: number}
}

type Result = Option & {
  score: number
}

type SavedDecision = {
  id: string
  decisionName: string
  options: Option[]
  criteria: Criteria[]
  results: Result[]
  createdAt: {
    seconds: number
    nanoseconds: number
  }
}

export default function DecisionMatrix() {
  const theme = useTheme()
  const [decisionName, setDecisionName] = useState<string>('')
  const [options, setOptions] = useState<Option[]>([
    { id: 1, name: 'Option 1', values: {} },
    { id: 2, name: 'Option 2', values: {} },
  ])
  
  const [criteria, setCriteria] = useState<Criteria[]>([
    { id: 1, name: '', percentage: 0, isBenefit: false },
    { id: 2, name: '', percentage: 0, isBenefit: false },
    { id: 3, name: '', percentage: 0, isBenefit: false }
  ])

  const [results, setResults] = useState<Result[] | null>(null)
  const [savedDecisions, setSavedDecisions] = useState<SavedDecision[]>([])
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [decisionToDelete, setDecisionToDelete] = useState<string | null>(null)

  const calculateScores = () => {
    if (!decisionName) {
      setNotification({ type: 'error', message: 'Please name your decision first' })
      return
    }

    if (criteria.some(c => c.percentage <= 0)) {
      setNotification({ type: 'error', message: 'All criteria percentage must be greater than 0' })
      return
    }

    const totalPercentage = criteria.reduce((sum, criterion) => sum + criterion.percentage, 0)
    
    const calculatedResults = options.map(option => {
      let score = 0
      
      criteria.forEach(criterion => {
        const value = option.values[criterion.name] || 0
        
        let normalizedValue
        if (criterion.isBenefit) {
          if (criterion.max !== undefined && criterion.min !== undefined) {
            normalizedValue = (value - criterion.min) / (criterion.max - criterion.min)
          } else {
            normalizedValue = value / 100
          }
        } else {
          if (criterion.max !== undefined && criterion.min !== undefined) {
            normalizedValue = 1 - ((value - criterion.min) / (criterion.max - criterion.min))
          } else {
            normalizedValue = 1 - (value / 100)
          }
        }

        score += normalizedValue * criterion.percentage
      })

      const finalScore = (score / totalPercentage) * 100

      return {
        ...option,
        score: Math.round(finalScore * 10) / 10,
      }
    })

    calculatedResults.sort((a, b) => b.score - a.score)
    setResults(calculatedResults)
    setNotification({ type: 'success', message: 'Analysis completed!' })
  }

  const saveDecision = async () => {
    // Validate all required fields
    if (!decisionName || !results) {
      setNotification({ type: 'error', message: 'Please complete the analysis first' });
      return;
    }
  
    // Validate criteria
    if (criteria.some(c => !c.name || c.percentage <= 0)) {
      setNotification({ type: 'error', message: 'All criteria must have names and positive weights' });
      return;
    }
  
    // Validate options
    if (options.some(opt => !opt.name)) {
      setNotification({ type: 'error', message: 'All options must have names' });
      return;
    }
  
    try {
      await addDoc(collection(db, "decisions"), {
        decisionName,
        options,
        criteria,
        results,
        createdAt: new Date(),
      });
      loadSavedDecisions();
      setNotification({ type: 'success', message: 'Decision saved successfully!' });
    } catch (error) {
      console.error("Error saving decision:", error);
      setNotification({ type: 'error', message: 'Failed to save decision' });
    }
  }

  const loadSavedDecisions = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "decisions"))
      const decisions: SavedDecision[] = []
      
      querySnapshot.forEach((doc) => {
        decisions.push({
          id: doc.id,
          ...doc.data() as Omit<SavedDecision, 'id'>
        })
      })
      
      decisions.sort((a, b) => b.createdAt.seconds - a.createdAt.seconds)
      setSavedDecisions(decisions)
    } catch (error) {
      console.error("Error loading decisions:", error)
    }
  }

  const handleDeleteDecision = async () => {
    if (!decisionToDelete) return
    
    try {
      await deleteDoc(doc(db, "decisions", decisionToDelete))
      loadSavedDecisions()
      setNotification({ type: 'success', message: 'Decision deleted successfully!' })
      setDeleteDialogOpen(false)
    } catch (error) {
      setNotification({ type: 'error', message: 'Failed to delete decision' })
    }
  }

  useEffect(() => {
    loadSavedDecisions()
  }, [])

  const generatePDF = () => {
    if (!results) return
    
    // Create a printable HTML content
    const printContent = `
      <html>
        <head>
          <title>Decision Report: ${decisionName}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .title { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
            .subtitle { font-size: 16px; color: #555; margin-bottom: 20px; }
            .section { margin-bottom: 30px; }
            .section-title { font-size: 18px; font-weight: bold; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 15px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .recommendation { background-color: #f9f9f9; padding: 15px; border-left: 4px solid #4CAF50; margin-bottom: 20px; }
            .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #777; }
            .chart-container { margin: 20px 0; text-align: center; }
            .chart { max-width: 600px; margin: 0 auto; }
            @media print {
              body { margin: 0; padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">Decision Analysis Report</div>
            <div class="subtitle">${decisionName}</div>
            <div>Generated on: ${new Date().toLocaleDateString()}</div>
          </div>
          
          <div class="section">
            <div class="section-title">Decision Summary</div>
            <div><strong>Decision:</strong> ${decisionName}</div>
            <div><strong>Date Analyzed:</strong> ${new Date().toLocaleDateString()}</div>
          </div>
          
          <div class="section">
            <div class="section-title">Criteria Weights</div>
            <table>
              <thead>
                <tr>
                  <th>Criterion</th>
                  <th>Weight</th>
                  <th>Preference</th>
                  <th>Range</th>
                </tr>
              </thead>
              <tbody>
                ${criteria.map(c => `
                  <tr>
                    <td>${c.name}</td>
                    <td>${c.percentage}%</td>
                    <td>${c.isBenefit ? 'Higher is better' : 'Lower is better'}</td>
                    <td>${c.min !== undefined && c.max !== undefined ? `${c.min}-${c.max}` : 'N/A'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          
          <div class="section">
            <div class="section-title">Options Evaluated</div>
            <table>
              <thead>
                <tr>
                  <th>Option Name</th>
                  ${criteria.map(c => `<th>${c.name}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${options.map(option => `
                  <tr>
                    <td>${option.name}</td>
                    ${criteria.map(c => `<td>${option.values[c.name] || 'N/A'}</td>`).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          
          <div class="section">
            <div class="section-title">Analysis Results</div>
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Option</th>
                  <th>Score</th>
                  ${criteria.map(c => `<th>${c.name}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${results.map((result, index) => `
                  <tr>
                    <td>${index + 1}</td>
                    <td>${result.name}</td>
                    <td>${result.score} points</td>
                    ${criteria.map(c => `<td>${result.values[c.name] || 'N/A'}</td>`).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          
          <div class="section">
            <div class="section-title">Recommendation</div>
            <div class="recommendation">
              <p><strong>Best Option:</strong> ${results[0].name} (Score: ${results[0].score} points)</p>
              <p><strong>Why this is the best choice:</strong></p>
              <ul>
                <li>${results[0].name} scored highest across all evaluated criteria</li>
                <li>It meets or exceeds expectations in key areas: ${criteria.slice(0, 2).map(c => c.name).join(', ')}</li>
                <li>The weighted scoring system confirms this as the optimal choice</li>
                <li>Consider verifying final decision with stakeholders if needed</li>
              </ul>
            </div>
          </div>
          
          <div class="footer">
            Report generated by Decision Matrix Analyzer
          </div>
        </body>
      </html>
    `
    
    // Open a new window with the printable content
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(printContent)
      printWindow.document.close()
      
      // Wait for content to load before printing
      printWindow.onload = function() {
        setTimeout(() => {
          printWindow.print()
        }, 500)
      }
    }
  }

  // Chart data for criteria weights pie chart
  const pieChartData = {
    labels: criteria.map(c => c.name),
    datasets: [
      {
        data: criteria.map(c => c.percentage),
        backgroundColor: [
          'rgba(255, 99, 132, 0.7)',
          'rgba(54, 162, 235, 0.7)',
          'rgba(255, 206, 86, 0.7)',
          'rgba(75, 192, 192, 0.7)',
          'rgba(153, 102, 255, 0.7)',
          'rgba(255, 159, 64, 0.7)'
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(153, 102, 255, 1)',
          'rgba(255, 159, 64, 1)'
        ],
        borderWidth: 1,
      },
    ],
  }

  const pieChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const label = context.label || ''
            const value = context.raw || 0
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0)
            const percentage = Math.round((value / total) * 100)
            return `${label}: ${value}% (${percentage}% of total)`
          }
        }
      }
    }
  }

  // Chart data for results bar chart
  const barChartData = {
    labels: results ? results.map(opt => opt.name) : options.map(opt => opt.name),
    datasets: [{
      label: 'Decision Score',
      data: results ? results.map(opt => opt.score) : options.map(() => 50),
      backgroundColor: theme.palette.mode === 'dark' 
        ? 'rgba(100, 181, 246, 0.7)' 
        : 'rgba(30, 136, 229, 0.7)',
      borderColor: theme.palette.mode === 'dark' 
        ? 'rgba(100, 181, 246, 1)' 
        : 'rgba(30, 136, 229, 1)',
      borderWidth: 1
    }],
  }

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            return `${context.dataset.label}: ${context.raw} points`
          }
        }
      }
    },
    scales: { 
      y: { 
        beginAtZero: true, 
        max: 100,
        title: {
          display: true,
          text: 'Score (points)'
        }
      },
      x: {
        title: {
          display: true,
          text: 'Options'
        }
      }
    }
  }

  return (
    <NoSSR>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        {notification && (
          <Alert 
            severity={notification.type} 
            sx={{ mb: 3 }} 
            onClose={() => setNotification(null)}
            elevation={4}
          >
            {notification.message}
          </Alert>
        )}

        <Box 
          sx={{ 
            textAlign: 'center', 
            mb: 4,
            background: theme.palette.mode === 'dark'
              ? 'linear-gradient(45deg, #121212 30%, #1e1e1e 90%)'
              : 'linear-gradient(45deg, #1976d2 30%, #2196f3 90%)',
            color: theme.palette.common.white,
            p: 3,
            borderRadius: 2,
            boxShadow: 3
          }}
        >
          <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
            Decision Matrix Analyzer
          </Typography>
          <Typography variant="subtitle1" gutterBottom>
            Make better decisions by evaluating your options against multiple criteria
          </Typography>
        </Box>

        {/* Decision Name */}
        <Card sx={{ mb: 4, boxShadow: 3 }}>
          <CardContent>
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
              <Avatar sx={{ bgcolor: 'primary.main', mr: 2, display: 'inline-flex' }}>
                1
              </Avatar>
              Decision Details
            </Typography>
            <TextField
              fullWidth
              label="Decision Name"
              value={decisionName}
              onChange={(e) => setDecisionName(e.target.value)}
              placeholder="What decision are you making? (e.g., 'Choosing a new laptop')"
              variant="outlined"
              size="medium"
              sx={{ mb: 2 }}
            />
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Give your decision a clear, descriptive name to help identify it later.
            </Typography>
          </CardContent>
        </Card>

        {/* Criteria Section */}
        <Card sx={{ mb: 4, boxShadow: 3 }}>
          <CardContent>
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
              <Avatar sx={{ bgcolor: 'secondary.main', mr: 2, display: 'inline-flex' }}>
                2
              </Avatar>
              Decision Criteria
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" gutterBottom>
              Define the factors that matter in your decision and their relative importance
            </Typography>
            
            <Box sx={{ mt: 1 }}>
              {criteria.map((criterion) => (
                <Paper key={criterion.id} elevation={2} sx={{ p: 2, borderRadius: 2, mb: 2 }}>
                  <Box sx={{ 
                    display: 'flex', 
                    flexDirection: { xs: 'column', md: 'row' }, 
                    gap: 2,
                    alignItems: { md: 'center' }
                  }}>
                    <Box sx={{ flex: 1 }}>
                    <TextField
                        fullWidth
                        label="Criterion Name"
                        value={criterion.name}
                          onChange={(e) => setCriteria(criteria.map((c,i) => 
                            c.id === criterion.id ? {...c, name: e.target.value} : c
                    ))}
                    placeholder="Enter criterion name"
                    variant="outlined"
                    size="small"
                    />
                    </Box>
                    
                    <Box sx={{ flex: 1, px: 1 }}>
                      <Typography variant="body2" gutterBottom>
                        Percentage: {criterion.percentage}%
                      </Typography>
                      <Slider
  value={criterion.percentage}
  onChange={(_, newValue) => {
    setCriteria(criteria.map(c => 
      c.id === criterion.id ? {...c, percentage: newValue as number} : c
    ))
  }}
                        min={1}
                        max={100}
                        valueLabelDisplay="auto"
                        aria-labelledby="percentage-slider"
                        color="secondary"
                      />
                    </Box>
                    
                    <Box sx={{ 
                      flex: 1,
                      display: 'flex', 
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 1
                    }}>
                      <TrendingUpIcon color={criterion.isBenefit ? 'success' : 'disabled'} />
                      <Switch
  checked={criterion.isBenefit}
  onChange={(e) => {
    setCriteria(criteria.map(c => 
      c.id === criterion.id ? {...c, isBenefit: e.target.checked} : c
    ))
  }}
  color="primary"
/>
                      <TrendingDownIcon color={!criterion.isBenefit ? 'error' : 'disabled'} />
                      <Typography variant="body2">
                        {criterion.isBenefit ? 'Higher is better' : 'Lower is better'}
                      </Typography>
                    </Box>
                    
                    <Box sx={{ flex: 1, display: 'flex', gap: 1 }}>
                    <TextField
  label="Min"
  type="number"
  value={criterion.min || ''}
  onChange={(e) => {
    setCriteria(criteria.map(c => 
      c.id === criterion.id ? {
        ...c, 
        min: e.target.value ? Number(e.target.value) : undefined
      } : c
    ))
  }}
                        size="small"
                        fullWidth
                      />
                      <TextField
  label="Max"
  type="number"
  value={criterion.max || ''}
  onChange={(e) => {
    setCriteria(criteria.map(c => 
      c.id === criterion.id ? {
        ...c, 
        max: e.target.value ? Number(e.target.value) : undefined
      } : c
    ))
  }}
                        size="small"
                        fullWidth
                      />
                    </Box>
                    
                    <Box>
                      <IconButton
                        color="error"
                        onClick={() => {
                          if (criteria.length > 1) {
                            setCriteria(criteria.filter(c => c.id !== criterion.id))
                          } else {
                            setNotification({ 
                              type: 'error', 
                              message: 'You must have at least one criterion' 
                            })
                          }
                        }}
                        size="large"
                      >
                        <RemoveCircleIcon />
                      </IconButton>
                    </Box>
                  </Box>
                </Paper>
              ))}
            </Box>
            
            <Button 
              variant="contained"
              color="secondary"
              startIcon={<AddCircleIcon />}
              onClick={() => setCriteria([...criteria, {
                id: Date.now(),
                name: `Criterion ${criteria.length + 1}`,
                percentage: 20,
                isBenefit: true
              }])}
              sx={{ mt: 2 }}
            >
              Add Criterion
            </Button>
          </CardContent>
        </Card>

        {/* Options Section */}
        <Card sx={{ mb: 4, boxShadow: 3 }}>
          <CardContent>
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
              <Avatar sx={{ bgcolor: 'info.main', mr: 2, display: 'inline-flex' }}>
                3
              </Avatar>
              Options to Compare
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" gutterBottom>
              Add the options you're considering and score them against each criterion
            </Typography>
            
            <Box sx={{ mt: 1 }}>
              {options.map((option) => (
                <Paper key={option.id} elevation={2} sx={{ p: 2, borderRadius: 2, mb: 2 }}>
                  <Box sx={{ 
                    display: 'flex', 
                    flexDirection: { xs: 'column', md: 'row' },
                    gap: 2,
                    alignItems: { md: 'center' }
                  }}>
                    <Box sx={{ flex: 1 }}>
                      <TextField
                        fullWidth
                        label="Option Name"
                        value={option.name}
                        onChange={(e) => setOptions(options.map(opt => 
                          opt.id === option.id ? {...opt, name: e.target.value} : opt
                        ))}
                        variant="outlined"
                        size="small"
                      />
                    </Box>
                    
                    {criteria.map(criterion => (
                      <Box key={`${option.id}-${criterion.id}`} sx={{ flex: 1 }}>
                        <TextField
  fullWidth
  label={`${criterion.name}`}
  type="number"
  value={option.values[criterion.name] || ''}
  onChange={(e) => {
    setOptions(options.map(opt => {
      if (opt.id === option.id) {
        return {
          ...opt,
          values: {
            ...opt.values,
            [criterion.name]: Number(e.target.value)
          }
        }
      }
      return opt
    }))
  }}
                          inputProps={{ 
                            min: criterion.min,
                            max: criterion.max,
                            step: criterion.min !== undefined && criterion.max !== undefined ? 
                                  (criterion.max - criterion.min)/100 : 1
                          }}
                          size="small"
                          helperText={
                            criterion.min !== undefined && criterion.max !== undefined 
                              ? `${criterion.min}-${criterion.max}`
                              : ''
                          }
                        />
                      </Box>
                    ))}
                    
                    <Box>
                      <IconButton
                        color="error"
                        onClick={() => {
                          if (options.length > 1) {
                            setOptions(options.filter(opt => opt.id !== option.id))
                          } else {
                            setNotification({ 
                              type: 'error', 
                              message: 'You must have at least one option' 
                            })
                          }
                        }}
                        size="large"
                      >
                        <RemoveCircleIcon />
                      </IconButton>
                    </Box>
                  </Box>
                </Paper>
              ))}
            </Box>
            
            <Button 
  onClick={() => {
    const newOption = {
      id: Date.now(),
      name: `Option ${options.length + 1}`,
      values: criteria.reduce((acc, curr) => {
        acc[curr.name] = 0;
        return acc;
      }, {} as {[key: string]: number})
    }
    setOptions([...options, newOption])
  }}
              sx={{ mt: 2 }}
            >
              Add Option
            </Button>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <Box sx={{ mb: 4, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
          <Button 
            fullWidth
            variant="contained" 
            size="large" 
            startIcon={<CalculateIcon />}
            onClick={calculateScores}
            sx={{ 
              py: 2,
              background: 'linear-gradient(45deg, #4CAF50 30%, #8BC34A 90%)',
              '&:hover': {
                background: 'linear-gradient(45deg, #388E3C 30%, #689F38 90%)',
              }
            }}
          >
            Calculate Scores
          </Button>
          <Button 
            fullWidth
            variant="contained" 
            size="large"
            startIcon={<SaveIcon />}
            onClick={saveDecision}
            disabled={!results || !decisionName}
            sx={{ 
              py: 2,
              background: 'linear-gradient(45deg, #FF9800 30%, #FFC107 90%)',
              '&:hover': {
                background: 'linear-gradient(45deg, #F57C00 30%, #FFA000 90%)',
              }
            }}
          >
            Save Decision
          </Button>
          <Button 
            fullWidth
            variant="contained" 
            color="error"
            size="large"
            startIcon={<PictureAsPdfIcon />}
            onClick={generatePDF}
            disabled={!results}
            sx={{ 
              py: 2,
              background: 'linear-gradient(45deg, #F44336 30%, #E91E63 90%)',
              '&:hover': {
                background: 'linear-gradient(45deg, #D32F2F 30%, #C2185B 90%)',
              }
            }}
          >
            Generate PDF Report
          </Button>
        </Box>

        {/* Results Section */}
        {results && (
          <Card sx={{ mb: 4, boxShadow: 3 }}>
            <CardContent>
              <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
                Results for: {decisionName}
              </Typography>
              
              {/* Charts Section */}
              <Box sx={{ 
                display: 'flex', 
                flexDirection: { xs: 'column', md: 'row' }, 
                gap: 4, 
                mb: 3,
                height: 400
              }}>
                <Box sx={{ flex: 1 }}>
                  <Bar 
                    data={barChartData} 
                    options={barChartOptions}
                  />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Pie 
                    data={pieChartData} 
                    options={pieChartOptions}
                  />
                </Box>
              </Box>
              
              <Typography variant="h6" gutterBottom sx={{ color: 'success.main' }}>
                Best Option: <strong>{results[0].name}</strong> (Score: {results[0].score} points)
              </Typography>
              
              <Box sx={{ 
                display: 'flex', 
                flexDirection: { xs: 'column', sm: 'row' },
                flexWrap: 'wrap',
                gap: 2
              }}>
                {results.map((option, index) => (
                  <Box key={option.id} sx={{ flex: 1, minWidth: 300 }}>
                    <Paper 
                      elevation={index === 0 ? 4 : 2} 
                      sx={{ 
                        p: 2, 
                        height: '100%',
                        borderLeft: index === 0 
                          ? `4px solid ${theme.palette.success.main}`
                          : index === 1
                          ? `4px solid ${theme.palette.info.main}`
                          : `4px solid ${theme.palette.warning.main}`
                      }}
                    >
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }} gutterBottom>
                        #{index + 1}: {option.name}
                      </Typography>
                      <Typography variant="body1" sx={{ mb: 1 }} gutterBottom>
                        <Box component="span" sx={{ 
                          fontWeight: 'bold', 
                          color: index === 0 
                            ? 'success.main' 
                            : index === 1 
                            ? 'info.main' 
                            : 'warning.main'
                        }}>
                          {option.score} points
                        </Box>
                      </Typography>
                      
                      <Divider sx={{ my: 1 }} />
                      
                      <Typography variant="body2" sx={{ mt: 1 }} gutterBottom>
                        <strong>Details:</strong>
                      </Typography>
                      <List dense sx={{ py: 0 }}>
                        {criteria.map(criterion => (
                          <ListItem key={criterion.name} sx={{ py: 0 }}>
                            <ListItemText
                              primary={`${criterion.name}: ${option.values[criterion.name] || 'N/A'}`}
                              secondary={
                                criterion.min !== undefined && criterion.max !== undefined 
                                  ? `(${criterion.min}-${criterion.max} scale)`
                                  : ''
                              }
                            />
                          </ListItem>
                        ))}
                      </List>
                    </Paper>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Saved Decisions Section */}
        {savedDecisions.length > 0 && (
          <Card sx={{ boxShadow: 3 }}>
            <CardContent>
              <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
                <Avatar sx={{ bgcolor: 'warning.main', mr: 2, display: 'inline-flex' }}>
                  <HistoryIcon />
                </Avatar>
                Saved Decisions
              </Typography>
              
              <List>
                {savedDecisions.map((decision) => (
                  <Paper key={decision.id} elevation={2} sx={{ mb: 2 }}>
                    <ListItem 
                      secondaryAction={
                        <IconButton 
                          edge="end" 
                          aria-label="delete"
                          onClick={() => {
                            setDecisionToDelete(decision.id)
                            setDeleteDialogOpen(true)
                          }}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      }
                    >
                      <ListItemText
                        primary={
                          <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }} gutterBottom>
                            {decision.decisionName}
                          </Typography>
                        }
                        secondary={
                          <>
                            <Typography variant="body2" component="span" gutterBottom>
                              {new Date(decision.createdAt.seconds * 1000).toLocaleString()}
                            </Typography>
                            <br />
                            <Typography variant="body2" component="span" gutterBottom>
                              Best Option: <strong>{decision.results[0]?.name || 'N/A'}</strong> 
                              {' '}(Score: {decision.results[0]?.score || 'N/A'})
                            </Typography>
                          </>
                        }
                      />
                    </ListItem>
                  </Paper>
                ))}
              </List>
            </CardContent>
          </Card>
        )}

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
          PaperProps={{
            sx: {
              borderRadius: 3,
              p: 2
            }
          }}
        >
          <DialogTitle sx={{ fontWeight: 'bold' }} gutterBottom>Confirm Delete</DialogTitle>
          <DialogContent>
            <Typography gutterBottom>
              Are you sure you want to delete this decision? This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button 
              onClick={() => setDeleteDialogOpen(false)}
              variant="outlined"
              sx={{ borderRadius: 2 }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleDeleteDecision} 
              color="error"
              variant="contained"
              sx={{ borderRadius: 2 }}
              startIcon={<DeleteIcon />}
            >
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </NoSSR>
  )
}