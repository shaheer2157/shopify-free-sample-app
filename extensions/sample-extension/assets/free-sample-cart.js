document.addEventListener("DOMContentLoaded", async () => {
  if (!window.location.pathname.includes("/cart")) return;

  console.log("🛒 Free Sample Cart JS Loaded");

  // --- Settings ---
  const threshold = window.FREE_SAMPLE_THRESHOLD;
  const productLimit = window.FREE_SAMPLE_LIMIT;

  // 🟢 UPDATE PRICE DISPLAY
  function updatePriceDisplay(cartItem, itemData) {
    const priceSelectors = [
      ".cart-items__price",
      ".cart-item__price",
      ".product-price",
      ".price",
      "[data-product-price]",
    ];

    priceSelectors.forEach((selector) => {
      const priceElement = cartItem.querySelector(selector);
      if (priceElement && !priceElement.querySelector(".free-price")) {
        const originalPrice = itemData.original_price
          ? (itemData.original_price / 100).toFixed(2)
          : (itemData.price / 100).toFixed(2);
        priceElement.innerHTML = `
          <span style="text-decoration: line-through; color: #999; margin-right: 8px; font-size: 12px;">
            $${originalPrice}
          </span>
          <span class="free-price" style="color: #4CAF50; font-weight: bold;">
            FREE
          </span>
        `;
        console.log("✅ Price updated to FREE for:", itemData.title);
      }
    });
  }

  // 🟢 DISABLE FREE SAMPLE INPUTS
  function disableFreeSampleInputs(cartItem) {
    // Disable quantity input
    const quantityInput = cartItem.querySelector(
      'input[name="updates[]"], .cart__qty-input, [data-quantity-input]',
    );
    if (quantityInput) {
      quantityInput.value = 1;
      quantityInput.disabled = true;
      quantityInput.readOnly = true;
      quantityInput.style.pointerEvents = "none";
      quantityInput.style.backgroundColor = "#f5f5f5";
      quantityInput.style.color = "#999";
      quantityInput.style.cursor = "not-allowed";
    }

    // Disable quantity buttons
    const buttons = cartItem.querySelectorAll(
      ".cart__qty-btn, [data-quantity-button], .quantity__button, .quantity-btn",
    );
    buttons.forEach((btn) => {
      btn.style.opacity = "0.5";
      btn.style.pointerEvents = "none";
      btn.style.cursor = "not-allowed";
      btn.disabled = true;
    });
  }

  // 🟢 UPDATE CART ITEMS UI WITH FREE SAMPLE PROPERTIES
  function updateCartItemsUI(cart) {
    console.log("🔄 Updating cart items UI with free sample properties...");

    // Get all cart items using various selectors - SPECIFIC TO YOUR CART TEMPLATE
    const cartItems = document.querySelectorAll(`
      .cart-items__table-row,
      [data-line-item], 
      [data-line-index], 
      [data-variant-id],
      .cart-item,
      .cart__row,
      tr[data-variant-id]
    `);

    console.log(`📦 Found ${cartItems.length} cart items to process`);

    cartItems.forEach((cartItem) => {
      let variantId = null;

      // Try different methods to get variant ID
      variantId =
        cartItem.dataset.variantId ||
        cartItem.dataset.lineItem ||
        cartItem.dataset.lineIndex;

      if (!variantId) {
        // Extract from input field
        const input = cartItem.querySelector('input[name="updates[]"]');
        if (input) {
          variantId =
            input.dataset.variantId ||
            input.dataset.lineIndex ||
            input.name.replace("updates[", "").replace("]", "");
        }
      }

      if (variantId) {
        const cartItemData = cart.items.find(
          (item) =>
            item.variant_id === parseInt(variantId) ||
            item.id === parseInt(variantId),
        );

        if (
          cartItemData &&
          cartItemData.properties &&
          cartItemData.properties._free_sample === "true"
        ) {
          // Update price and disable inputs for free samples
          updatePriceDisplay(cartItem, cartItemData);
          disableFreeSampleInputs(cartItem);
        }
      }
    });
  }

  // 🟢 STRICTER VERSION: Completely disable free sample quantity inputs on page load
  function disableFreeSampleQuantityInputs() {
    const quantityInputs = document.querySelectorAll(
      'input[name="updates[]"], .cart__qty-input, [data-quantity-input]',
    );

    quantityInputs.forEach(async (input) => {
      const lineItem =
        input.dataset.lineIndex ||
        input.name.replace("updates[", "").replace("]", "");

      if (!lineItem) return;

      try {
        const cart = await fetch("/cart.js").then((r) => r.json());
        const currentItem = cart.items.find(
          (item) =>
            item.id === parseInt(lineItem) ||
            item.variant_id === parseInt(lineItem),
        );

        if (
          currentItem &&
          currentItem.properties &&
          currentItem.properties._free_sample === "true"
        ) {
          // 🟢 COMPLETELY DISABLE the input
          input.value = 1;
          input.disabled = true;
          input.readOnly = true;
          input.style.pointerEvents = "none";
          input.style.backgroundColor = "#f5f5f5";
          input.style.color = "#999";
          input.style.cursor = "not-allowed";

          // 🟢 DISABLE quantity buttons too
          const buttons = input
            .closest(".cart__quantity, .quantity, .cart-items__quantity")
            ?.querySelectorAll("button");
          if (buttons) {
            buttons.forEach((btn) => {
              btn.style.opacity = "0.5";
              btn.style.pointerEvents = "none";
              btn.style.cursor = "not-allowed";
            });
          }

          console.log(
            "🔒 Free sample quantity input disabled:",
            currentItem.title,
          );
        }
      } catch (error) {
        console.error("Error checking free sample item:", error);
      }
    });
  }

  // 🟢 CHECKOUT VALIDATION - FREE SAMPLE QUANTITY CHECK + THRESHOLD + LIMIT
  function setupCheckoutValidation() {
    console.log("🔧 Setting up checkout validation...");

    document.addEventListener("click", async function (e) {
      if (
        e.target.closest(
          '[name="checkout"], .cart__checkout, .shopify-payment-button__button',
        )
      ) {
        console.log(
          "💰 Checkout button clicked - validating free sample quantities...",
        );

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        const checkoutBtn = e.target.closest(
          '[name="checkout"], .cart__checkout, .shopify-payment-button__button',
        );

        // Show loading
        checkoutBtn.disabled = true;
        const originalText = checkoutBtn.textContent;
        checkoutBtn.textContent = "Checking...";

        try {
          // Cart data get karo
          const cart = await fetch("/cart.js").then((r) => r.json());

          // 🟢 CHECK 1: Free sample products with quantity > 1
          const invalidFreeSamples = cart.items.filter(
            (item) =>
              item.properties &&
              item.properties._free_sample === "true" &&
              item.quantity > 1,
          );

          // 🟢 CHECK 2: Threshold check
          const subtotal = cart.items_subtotal_price;
          const minSubtotal = (threshold || 0) * 100;
          const isThresholdMet = subtotal >= minSubtotal;

          // 🟢 CHECK 3: Free sample count check
          const freeSampleCount = cart.items.reduce((total, item) => {
            return item.properties?._free_sample === "true"
              ? total + item.quantity
              : total;
          }, 0);
          const isWithinLimit = freeSampleCount <= productLimit;

          let errorMessage = "";

          // Check all validations
          if (invalidFreeSamples.length > 0) {
            errorMessage = `Free samples cannot have quantity more than 1. Please fix quantities.`;
          } else if (!isThresholdMet) {
            const amountNeeded = threshold - subtotal / 100;
            errorMessage = `Add $${amountNeeded.toFixed(2)} more to qualify for free samples.`;
          } else if (!isWithinLimit) {
            errorMessage = `You can only add ${productLimit} free sample(s) to your order.`;
          }

          if (errorMessage) {
            console.log("❌ Checkout validation failed:", errorMessage);

            // Show error message
            showTempMessage(errorMessage, "warning");

            // Restore button
            checkoutBtn.textContent = originalText;
            checkoutBtn.disabled = false;
          } else {
            // All validations passed - proceed to checkout
            console.log("✅ All validations passed - proceeding to checkout");
            checkoutBtn.textContent = "Redirecting...";

            // Direct checkout redirect
            window.location.href = "/checkout";
          }
        } catch (error) {
          console.error("❌ Error during checkout validation:", error);
          checkoutBtn.textContent = "Error - Try Again";
          setTimeout(() => {
            checkoutBtn.textContent = originalText;
            checkoutBtn.disabled = false;
          }, 2000);
        }

        return false;
      }
    });
  }

  // 🟢 ULTRA STRICT: Completely disable + buttons for free samples
  function disableFreeSamplePlusButtons() {
    console.log("🔒 Disabling free sample + buttons...");

    const plusButtons = document.querySelectorAll(
      ".cart__qty-btn, [data-quantity-button], .quantity__button",
    );

    plusButtons.forEach(async (button) => {
      // Check if it's a plus button
      const isPlusButton =
        button.classList.contains("plus") ||
        button.textContent.includes("+") ||
        button.querySelector("span")?.textContent.includes("+") ||
        button.dataset.quantityButton === "plus";

      if (!isPlusButton) return;

      const input = button
        .closest(".cart__quantity, .quantity, .cart-items__quantity")
        ?.querySelector('input[name="updates[]"]');
      if (!input) return;

      const lineItem =
        input.dataset.lineIndex ||
        input.name.replace("updates[", "").replace("]", "");
      if (!lineItem) return;

      try {
        const cart = await fetch("/cart.js").then((r) => r.json());
        const currentItem = cart.items.find(
          (item) =>
            item.id === parseInt(lineItem) ||
            item.variant_id === parseInt(lineItem),
        );

        if (
          currentItem &&
          currentItem.properties &&
          currentItem.properties._free_sample === "true"
        ) {
          console.log(
            "🔒 Disabling + button for free sample:",
            currentItem.title,
          );

          // 🟢 COMPLETELY DISABLE THE + BUTTON
          button.disabled = true;
          button.style.opacity = "0.3";
          button.style.pointerEvents = "none";
          button.style.cursor = "not-allowed";
          button.style.backgroundColor = "#f0f0f0";
          button.style.borderColor = "#ddd";
          button.style.color = "#999";

          // 🟢 REMOVE ALL EVENT LISTENERS
          const newButton = button.cloneNode(true);
          button.parentNode.replaceChild(newButton, button);
          newButton.disabled = true;
          newButton.style.opacity = "0.3";
          newButton.style.pointerEvents = "none";
          newButton.style.cursor = "not-allowed";
          newButton.style.backgroundColor = "#f0f0f0";
          newButton.style.borderColor = "#ddd";
          newButton.style.color = "#999";
        }
      } catch (error) {
        console.error("Error disabling + button:", error);
      }
    });
  }

  // 🟢 ULTIMATE SOLUTION: Event delegation with mutation observer
  function setupUltimateCartOverride() {
    console.log("🔧 Setting up ultimate cart override...");

    // Use event delegation at document level
    document.addEventListener("click", async function (e) {
      // Remove buttons - INTERCEPT ALL PRODUCTS (FREE SAMPLES & REGULAR)
      if (e.target.closest("[data-cart-remove]")) {
        const removeBtn = e.target.closest("[data-cart-remove]");
        const lineItem = removeBtn.dataset.lineItem;

        if (lineItem) {
          try {
            const cart = await fetch("/cart.js").then((r) => r.json());
            const currentItem = cart.items.find(
              (item) =>
                item.id === parseInt(lineItem) ||
                item.variant_id === parseInt(lineItem),
            );

            // 🟢 INTERCEPT BOTH FREE SAMPLES AND REGULAR PRODUCTS
            if (currentItem) {
              e.preventDefault();
              e.stopPropagation();
              e.stopImmediatePropagation();

              console.log("🗑️ Remove button intercepted - reloading page");
              await handleCartRemoval(removeBtn);
              return false;
            }
          } catch (error) {
            console.error("Error checking product type:", error);
            return; // Allow default behavior on error
          }
        }
      }

      // 🟢 QUANTITY BUTTONS - STRICT FREE SAMPLE CHECK
      if (
        e.target.closest(
          ".cart__qty-btn, [data-quantity-button], .quantity__button",
        )
      ) {
        const button = e.target.closest(
          ".cart__qty-btn, [data-quantity-button], .quantity__button",
        );

        // Check if it's a PLUS button
        const isPlusButton =
          button.classList.contains("plus") ||
          button.textContent.includes("+") ||
          button.querySelector("span")?.textContent.includes("+") ||
          button.dataset.quantityButton === "plus";

        if (isPlusButton) {
          const input = button
            .closest(".cart__quantity, .quantity, .cart-items__quantity")
            ?.querySelector('input[name="updates[]"]');

          if (input) {
            const lineItem =
              input.dataset.lineIndex ||
              input.name.replace("updates[", "").replace("]", "");

            if (lineItem) {
              try {
                const cart = await fetch("/cart.js").then((r) => r.json());
                const currentItem = cart.items.find(
                  (item) =>
                    item.id === parseInt(lineItem) ||
                    item.variant_id === parseInt(lineItem),
                );

                // 🟢 BLOCK PLUS BUTTON FOR FREE SAMPLES
                if (
                  currentItem &&
                  currentItem.properties &&
                  currentItem.properties._free_sample === "true"
                ) {
                  e.preventDefault();
                  e.stopPropagation();
                  e.stopImmediatePropagation();

                  console.log(
                    "🚫 Free sample + button BLOCKED:",
                    currentItem.title,
                  );
                  showTempMessage(
                    "Free sample quantity cannot be increased",
                    "warning",
                  );

                  // 🟢 VISUALLY DISABLE THE BUTTON
                  button.style.opacity = "0.3";
                  button.style.pointerEvents = "none";
                  button.style.cursor = "not-allowed";

                  return false;
                }
              } catch (error) {
                console.error("Error checking free sample:", error);
              }
            }
          }
        }

        // For regular products or minus buttons, proceed normally
        e.preventDefault();
        e.stopPropagation();
        console.log("🔢 Quantity button intercepted");
        await handleQuantityButton(button);
        return false;
      }
    });

    // Quantity inputs
    document.addEventListener("change", function (e) {
      if (
        e.target.matches(
          'input[name="updates[]"], .cart__qty-input, [data-quantity-input]',
        )
      ) {
        e.preventDefault();
        e.stopPropagation();

        console.log("🔢 Quantity input intercepted");
        handleQuantityChange(e.target);
        return false;
      }
    });

    console.log("✅ Event listeners setup complete");
  }

  // 🟢 Handle cart removal - WITH PAGE RELOAD
  async function handleCartRemoval(removeBtn) {
    try {
      console.log('🔄 Starting product removal...');
      
      removeBtn.style.opacity = '0.5';
      removeBtn.style.pointerEvents = 'none';

      const lineItem = removeBtn.dataset.lineItem;
      
      if (!lineItem) {
        console.error('❌ Line item not found');
        restoreButton(removeBtn);
        return;
      }

      const response = await fetch('/cart/change.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ line: lineItem, quantity: 0 })
      });

      if (response.ok) {
        console.log('✅ Product removed - Reloading page...');
        
        // 🟢 RELOAD THE WHOLE PAGE instead of AJAX updates
        window.location.reload();
        
      } else {
        throw new Error('Failed to remove item');
      }
      
    } catch (error) {
      console.error('❌ Error in cart removal:', error);
      showTempMessage('Error removing product', 'warning');
      restoreButton(removeBtn);
    }
  }

  // 🟢 Restore button state
  function restoreButton(button) {
    button.style.opacity = "1";
    button.style.pointerEvents = "auto";
  }

  // 🟢 Handle quantity change - WITH PAGE RELOAD
  async function handleQuantityChange(input) {
    try {
      const lineItem =
        input.dataset.lineIndex ||
        input.name.replace("updates[", "").replace("]", "");

      if (!lineItem) {
        console.error("❌ Line item not found for quantity update");
        return;
      }

      // FINAL SAFETY CHECK
      const cart = await fetch("/cart.js").then((r) => r.json());
      const currentItem = cart.items.find(
        (item) =>
          item.id === parseInt(lineItem) ||
          item.variant_id === parseInt(lineItem),
      );

      if (
        currentItem &&
        currentItem.properties &&
        currentItem.properties._free_sample === "true"
      ) {
        input.value = 1;
        showTempMessage("Free sample quantity cannot be changed", "warning");
        return;
      }

      const newQuantity = parseInt(input.value);
      if (newQuantity < 0) return;

      input.disabled = true;

      const response = await fetch("/cart/change.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ line: lineItem, quantity: newQuantity }),
      });

      if (response.ok) {
        console.log("✅ Quantity updated - Reloading page...");
        
        // 🟢 RELOAD THE WHOLE PAGE instead of AJAX updates
        window.location.reload();
        
      } else {
        throw new Error("Failed to update quantity");
      }
    } catch (error) {
      console.error("❌ Error updating quantity:", error);
    } finally {
      input.disabled = false;
    }
  }

  // 🟢 Handle quantity buttons
  async function handleQuantityButton(button) {
    try {
      const input =
        button
          .closest(".cart__quantity, .quantity, .cart-items__quantity")
          ?.querySelector('input[name="updates[]"]') ||
        button.closest(".quantity")?.querySelector("input") ||
        button.previousElementSibling ||
        button.nextElementSibling;

      if (!input || input.type !== "number") return;

      // Check if it's a PLUS button
      const isPlusButton =
        button.classList.contains("plus") ||
        button.textContent.includes("+") ||
        button.querySelector("span")?.textContent.includes("+") ||
        button.dataset.quantityButton === "plus";

      let newQuantity = parseInt(input.value);

      if (isPlusButton) {
        newQuantity++;
      } else if (
        button.classList.contains("minus") ||
        button.textContent.includes("-")
      ) {
        newQuantity = Math.max(0, newQuantity - 1);
      }

      input.value = newQuantity;

      const event = new Event("change", { bubbles: true });
      input.dispatchEvent(event);
    } catch (error) {
      console.error("❌ Error handling quantity button:", error);
    }
  }

  // 🟢 Utility function to show temporary messages
  function showTempMessage(message, type = "info") {
    const existingMessages = document.querySelectorAll(".temp-message");
    existingMessages.forEach((msg) => msg.remove());

    const messageDiv = document.createElement("div");
    messageDiv.className = "temp-message";
    messageDiv.textContent = message;
    messageDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      background: ${type === "warning" ? "#ff9800" : "#4CAF50"};
      color: white;
      border-radius: 5px;
      z-index: 10000;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      max-width: 300px;
    `;

    document.body.appendChild(messageDiv);

    setTimeout(() => {
      messageDiv.style.transition = "all 0.3s ease";
      messageDiv.style.opacity = "0";
      setTimeout(() => {
        if (messageDiv.parentNode) {
          messageDiv.parentNode.removeChild(messageDiv);
        }
      }, 300);
    }, 3000);
  }

  // 🟢 Refresh free sample products - WITH PAGE RELOAD ON ADD TO CART
  async function refreshFreeSampleProducts() {
    console.log('🔍 DEBUG: refreshFreeSampleProducts called');
    
    try {
      console.log('🔄 Refreshing free sample products...');
      
      const freeSampleWidget = document.getElementById('free-sample-widget');
      if (!freeSampleWidget) {
        console.log('❌ Free sample widget not found');
        return;
      }

      const productsContainer = document.getElementById('free-sample-products-container');
      if (!productsContainer) {
        console.log('❌ Products container not found');
        return;
      }

      console.log('🔄 Fetching cart and products data...');

      productsContainer.innerHTML = '<div style="padding:20px; text-align:center;">Refreshing free samples...</div>';

      const [cart, productsData] = await Promise.all([
        fetch('/cart.js').then(r => r.json()),
        fetch('/collections/all/products.json?limit=50').then(r => r.json())
      ]);

      console.log('📊 Cart data after refresh:', cart);
      console.log('📦 Products data:', productsData);

      // 🟢 UPDATE CART ITEMS UI
      updateCartItemsUI(cart);

      const freeSampleProducts = productsData.products.filter(p => 
        p.tags?.some(tag => tag.toLowerCase().trim() === "free-sample")
      );

      console.log('🎁 Free sample products found:', freeSampleProducts.length);

      if (freeSampleProducts.length === 0) {
        productsContainer.innerHTML = "<p>No free sample products available.</p>";
        return;
      }

      const freeSampleCount = cart.items.reduce((total, item) => {
        return item.properties?._free_sample === "true" ? total + 1 : total;
      }, 0);

      const subtotal = cart.items_subtotal_price;
      const minSubtotal = (threshold || 0) * 100;
      const isThresholdMet = subtotal >= minSubtotal;

      console.log('📊 Free sample count:', freeSampleCount);
      console.log('💰 Subtotal:', subtotal, 'Min required:', minSubtotal, 'Threshold met:', isThresholdMet);

      productsContainer.innerHTML = `
        <div class="keen-slider free-sample-keen-slider">
          ${freeSampleProducts.map(product => {
            const variantId = product.variants?.[0]?.id || "";
            const isInCart = cart.items.some(
              item => item.variant_id === parseInt(variantId) && item.properties?._free_sample === "true"
            );
          
            const isDisabled = !isThresholdMet || freeSampleCount >= productLimit || isInCart;

            console.log('🛍️ Product:', product.title, 'Variant:', variantId, 'In cart:', isInCart, 'Disabled:', isDisabled);

            return `
              <div class="keen-slider__slide free-sample-keen-slider__slide">
                <a href="/products/${product.handle}" class="free-sample-keen-slider__product-link">
                  <span class="free-sample-keen-slider__image-wrap">
                    <img src="${product.images?.[0]?.src || ""}" alt="${product.title}" class="free-sample-keen-slider__product-image" loading="lazy" decoding="async" width="400" height="400">
                  </span>
                </a>
                <p class="free-sample-keen-slider__product-title">${product.title}</p>
                <button class="add-free-sample-btn free-sample-keen-slider__add-btn" data-variant-id="${variantId}" ${isDisabled ? "disabled" : ""}>
                  ${isInCart ? "Added ✓" : "Add to Cart"}
                </button>
                ${!isThresholdMet ? `<p class="free-sample-keen-slider__threshold-msg">Add $${threshold} more to unlock</p>` : ""}
              </div>
            `;
          }).join('')}
        </div>
      `;

      // Add event listeners - MODIFIED FOR PAGE RELOAD
      const addButtons = productsContainer.querySelectorAll('.add-free-sample-btn:not([disabled])');
      console.log('🔘 Add buttons found:', addButtons.length);
      
      addButtons.forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.preventDefault();
          const variantId = btn.dataset.variantId;
          
          btn.textContent = "Adding...";
          btn.disabled = true;

          try {
            await fetch("/cart/add.js", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: variantId,
                quantity: 1,
                properties: { _free_sample: "true" },
              }),
            });

            // ✅ RELOAD THE WHOLE PAGE instead of AJAX updates
            console.log("🔄 Free sample added - reloading page...");
            window.location.reload();
            
          } catch (err) {
            console.error(err);
            btn.textContent = "Error - Try Again";
            setTimeout(() => {
              btn.textContent = "Add to Cart";
              btn.disabled = false;
            }, 2000);
          }
        });
      });

      console.log('✅ Free sample products refreshed');

    } catch (error) {
      console.error('❌ Error refreshing free samples:', error);
    }
  }

  // 🟢 Initialize
  function initialize() {
    console.log("🚀 Initializing checkout validation...");

    setupUltimateCartOverride();
    setupCheckoutValidation();

    // Multiple attempts to disable + buttons and add badges
    setTimeout(() => {
      disableFreeSamplePlusButtons();
      disableFreeSampleQuantityInputs();
    }, 500);

    setTimeout(() => {
      disableFreeSamplePlusButtons();
      disableFreeSampleQuantityInputs();
    }, 1000);

    setTimeout(() => {
      disableFreeSamplePlusButtons();
      disableFreeSampleQuantityInputs();
    }, 1500);

    setTimeout(() => {
      disableFreeSamplePlusButtons();
      disableFreeSampleQuantityInputs();
    }, 2000);

    setTimeout(() => {
      disableFreeSamplePlusButtons();
      disableFreeSampleQuantityInputs();
    }, 3000);

    // Refresh products
    setTimeout(() => refreshFreeSampleProducts(), 1000);
  }

  // Start
  initialize();
});