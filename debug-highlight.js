// Quick diagnostic script to check if search text exists in document
// Run this in browser console when the highlighting issue occurs

function checkHighlightText() {
  const searchText = 'Eff ective 7/1/13 ( 29 ) "Moral turpitude" means an act done contrary to honesty and good morals';
  const documentContent = document.querySelector('.document-content');
  
  if (!documentContent) {
    console.log('❌ No document content found');
    return;
  }
  
  const fullText = documentContent.textContent || documentContent.innerText;
  console.log('📄 Document length:', fullText.length);
  
  // Check for exact match
  if (fullText.includes(searchText)) {
    console.log('✅ Exact text found in document');
  } else {
    console.log('❌ Exact text NOT found');
    
    // Check for parts of the text
    const keyTerms = ['Moral turpitude', 'effective', 'honesty', 'good morals'];
    keyTerms.forEach(term => {
      if (fullText.toLowerCase().includes(term.toLowerCase())) {
        console.log(`✅ Found term: "${term}"`);
        
        // Find context around the term
        const index = fullText.toLowerCase().indexOf(term.toLowerCase());
        const context = fullText.substring(Math.max(0, index - 100), index + term.length + 100);
        console.log(`📍 Context: "${context}"`);
      } else {
        console.log(`❌ Missing term: "${term}"`);
      }
    });
  }
}

// Run the check
checkHighlightText();