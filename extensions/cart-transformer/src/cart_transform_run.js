export function cartTransformRun(input) {
  const operations = [];

  console.log('🛒 Starting cart transform...');

  for (const line of input.cart.lines) {
    console.log(`Processing line: ${line.id}`);
    
    // Check for free sample attribute
    if (line.attribute && 
        line.attribute.key === "_free_sample" && 
        line.attribute.value === "true") {
      
      console.log(`✅ Found free sample: ${line.merchandise.product.title}`);
      console.log(`🎯 Setting price to 0`);
      
      operations.push({
        lineUpdate: {
          cartLineId: line.id,
          price: {
            adjustment: {
              fixedPricePerUnit: { 
                amount: "0.00"
              },
            },
          },
        },
      });
    }
  }

  console.log(`📊 Total operations to apply: ${operations.length}`);
  
  
  if (operations.length > 0) {
    console.log('🚀 Applying price adjustments');
    return { operations };
  } else {
    console.log('➡️ No changes needed');
    return NO_CHANGES;
  }
}