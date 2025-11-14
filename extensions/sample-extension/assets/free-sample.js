document.addEventListener("DOMContentLoaded", async () => {
  if (!window.location.pathname.includes("/cart")) return;

  console.log("🛒 Free Sample Cart JS Loaded");

  // --- Settings ---
  const threshold = window.FREE_SAMPLE_THRESHOLD;
  const productLimit = window.FREE_SAMPLE_LIMIT;

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
            .closest(".cart__quantity, .quantity")
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

              if (
                currentItem.properties &&
                currentItem.properties._free_sample === "true"
              ) {
                console.log("🗑️ Free sample remove button intercepted");
                await handleCartRemoval(removeBtn);
              } else {
                console.log("🛒 Regular product remove button intercepted");
                await handleCartRemoval(removeBtn); // Handle regular products too
              }
              return false;
            }
          } catch (error) {
            console.error("Error checking product type:", error);
            // If error, allow default behavior
            return;
          }
        }
      }

      // Quantity buttons
      if (
        e.target.closest(
          ".cart__qty-btn, [data-quantity-button], .quantity__button",
        )
      ) {
        e.preventDefault();
        e.stopPropagation();

        const qtyBtn = e.target.closest(
          ".cart__qty-btn, [data-quantity-button], .quantity__button",
        );
        console.log("➕ Quantity button intercepted");
        await handleQuantityButton(qtyBtn);
        return false;
      }

      // ✅ CHECKOUT BUTTONS - Allow to work normally
      if (
        e.target.closest(
          '[name="checkout"], .cart__checkout, .shopify-payment-button__button',
        )
      ) {
        console.log("💰 Checkout button clicked - allowing normal behavior");
        // Let checkout work normally - NO prevention
        return;
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
      console.log("🔄 Starting product removal...");

      // Immediate visual feedback
      removeBtn.style.opacity = "0.5";
      removeBtn.style.pointerEvents = "none";

      const lineItem = removeBtn.dataset.lineItem;

      if (!lineItem) {
        console.error("❌ Line item not found");
        restoreButton(removeBtn);
        return;
      }

      // AJAX call to remove item
      const response = await fetch("/cart/change.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ line: lineItem, quantity: 0 }),
      });

      if (response.ok) {
        console.log("✅ Product removed - Reloading page...");
        
        // 🟢 RELOAD THE WHOLE PAGE instead of refreshing components
        window.location.reload();
        
      } else {
        throw new Error("Failed to remove item");
      }
    } catch (error) {
      console.error("❌ Error in cart removal:", error);
      showTempMessage("Error removing product", "warning");
      restoreButton(removeBtn);
    }
  }

  // 🟢 Restore button state
  function restoreButton(button) {
    button.style.opacity = "1";
    button.style.pointerEvents = "auto";
  }

  // 🟢 Handle quantity change - WITH PAGE RELOAD FOR REGULAR PRODUCTS
  async function handleQuantityChange(input) {
    try {
      const lineItem =
        input.dataset.lineIndex ||
        input.name.replace("updates[", "").replace("]", "");

      if (!lineItem) {
        console.error("❌ Line item not found for quantity update");
        return;
      }

      // 🟢 CRITICAL FIX: Check if this is a free sample product
      const cart = await fetch("/cart.js").then((r) => r.json());
      const currentItem = cart.items.find(
        (item) =>
          item.id === parseInt(lineItem) ||
          item.variant_id === parseInt(lineItem),
      );

      // If it's a free sample product, PREVENT any quantity change
      if (
        currentItem &&
        currentItem.properties &&
        currentItem.properties._free_sample === "true"
      ) {
        console.log("⚠️ Free sample product - quantity cannot be changed");

        // 🟢 IMMEDIATELY reset to 1 without any delay
        input.value = 1;

        // 🟢 DISABLE the input completely
        input.disabled = true;
        input.readOnly = true;
        input.style.pointerEvents = "none";
        input.style.backgroundColor = "#f5f5f5";
        input.style.color = "#999";
        input.style.cursor = "not-allowed";

        showTempMessage("Free sample quantity cannot be changed", "warning");
        return; // ❌ COMPLETELY BLOCK THE UPDATE
      }

      // Regular products ke liye normal flow
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
        
        // 🟢 RELOAD THE WHOLE PAGE for regular product quantity changes
        window.location.reload();
        
      } else {
        throw new Error("Failed to update quantity");
      }
    } catch (error) {
      console.error("❌ Error updating quantity:", error);
      input.disabled = false;
    }
  }

  // 🟢 Handle quantity buttons - FREE SAMPLE PROTECTION
  async function handleQuantityButton(button) {
    try {
      const input =
        button
          .closest(".cart__quantity")
          ?.querySelector('input[name="updates[]"]') ||
        button.closest(".quantity")?.querySelector("input") ||
        button.previousElementSibling ||
        button.nextElementSibling;

      if (!input || input.type !== "number") return;

      const lineItem =
        input.dataset.lineIndex ||
        input.name.replace("updates[", "").replace("]", "");

      // 🟢 CRITICAL FIX: Check if this is a free sample product
      const cart = await fetch("/cart.js").then((r) => r.json());
      const currentItem = cart.items.find(
        (item) =>
          item.id === parseInt(lineItem) ||
          item.variant_id === parseInt(lineItem),
      );

      const isFreeSample =
        currentItem &&
        currentItem.properties &&
        currentItem.properties._free_sample === "true";

      // 🟢 If free sample, COMPLETELY BLOCK button functionality
      if (isFreeSample) {
        console.log("⚠️ Free sample product - quantity buttons disabled");

        // 🟢 VISUALLY DISABLE the buttons
        button.style.opacity = "0.5";
        button.style.pointerEvents = "none";
        button.style.cursor = "not-allowed";

        // 🟢 Also disable the input
        input.value = 1;
        input.disabled = true;
        input.readOnly = true;
        input.style.pointerEvents = "none";
        input.style.backgroundColor = "#f5f5f5";
        input.style.color = "#999";
        input.style.cursor = "not-allowed";

        showTempMessage("Free sample quantity cannot be changed", "warning");
        return;
      }

      let newQuantity = parseInt(input.value);

      if (
        button.classList.contains("plus") ||
        button.textContent.includes("+")
      ) {
        newQuantity++;
      } else if (
        button.classList.contains("minus") ||
        button.textContent.includes("-")
      ) {
        newQuantity = Math.max(0, newQuantity - 1);
      }

      input.value = newQuantity;

      // Create and dispatch change event
      const event = new Event("change", { bubbles: true });
      input.dispatchEvent(event);
    } catch (error) {
      console.error("❌ Error handling quantity button:", error);
    }
  }

  // 🟢 Utility function to show temporary messages
  function showTempMessage(message, type = "info") {
    // Remove existing messages first
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

  // 🟢 Update cart totals
  function updateCartTotals(cart) {
    try {
      // Update item count
      const cartCounts = document.querySelectorAll(
        '[ref="cartItemCount"], .cart-count, [data-cart-count]',
      );
      cartCounts.forEach((el) => {
        if (el) el.textContent = cart.item_count;
      });

      // Update total price
      const cartTotals = document.querySelectorAll(
        ".cart__total-value, [data-cart-total]",
      );
      cartTotals.forEach((el) => {
        if (el) {
          if (typeof Shopify !== "undefined" && Shopify.formatMoney) {
            el.textContent = Shopify.formatMoney(
              cart.total_price,
              window.money_format,
            );
          } else {
            el.textContent = "$" + (cart.total_price / 100).toFixed(2);
          }
        }
      });

      console.log("✅ Cart totals updated");
    } catch (error) {
      console.error("❌ Error updating cart totals:", error);
    }
  }

  // 🟢 Refresh free sample products - WITH PAGE RELOAD ON ADD TO CART
  async function refreshFreeSampleProducts() {
    console.log("🔍 DEBUG: refreshFreeSampleProducts called");

    try {
      console.log("🔄 Refreshing free sample products...");

      const freeSampleWidget = document.getElementById("free-sample-widget");
      if (!freeSampleWidget) {
        console.log("❌ Free sample widget not found");
        return;
      }

      const productsContainer = document.getElementById(
        "free-sample-products-container",
      );
      if (!productsContainer) {
        console.log("❌ Products container not found");
        return;
      }

      console.log("🔄 Fetching cart and products data...");

      // Show loading
      productsContainer.innerHTML =
        '<div style="padding:20px; text-align:center;">Refreshing free samples...</div>';

      // Fetch data
      const [cart, productsData] = await Promise.all([
        fetch("/cart.js").then((r) => r.json()),
        fetch("/collections/all/products.json?limit=50").then((r) => r.json()),
      ]);

      console.log("📊 Cart data after refresh:", cart);
      console.log("📦 Products data:", productsData);

      const freeSampleProducts = productsData.products.filter((p) =>
        p.tags?.some((tag) => tag.toLowerCase().trim() === "free-sample"),
      );

      console.log("🎁 Free sample products found:", freeSampleProducts.length);

      // Render products
      if (freeSampleProducts.length === 0) {
        productsContainer.innerHTML =
          "<p>No free sample products available.</p>";
        return;
      }

      const freeSampleCount = cart.items.reduce((total, item) => {
        return item.properties?._free_sample === "true" ? total + 1 : total;
      }, 0);

      const subtotal = cart.items_subtotal_price;
      const minSubtotal = (threshold || 0) * 100;
      const isThresholdMet = subtotal >= minSubtotal;

      console.log("📊 Free sample count:", freeSampleCount);
      console.log(
        "💰 Subtotal:",
        subtotal,
        "Min required:",
        minSubtotal,
        "Threshold met:",
        isThresholdMet,
      );

      productsContainer.innerHTML = `
      <div class="free-sample-scroll">
        ${freeSampleProducts
          .map((product) => {
            const variantId = product.variants?.[0]?.id || "";
            const isInCart = cart.items.some(
              (item) =>
                item.variant_id === parseInt(variantId) &&
                item.properties?._free_sample === "true",
            );

            const isDisabled =
              !isThresholdMet || freeSampleCount >= productLimit || isInCart;

            console.log(
              "🛍️ Product:",
              product.title,
              "Variant:",
              variantId,
              "In cart:",
              isInCart,
              "Disabled:",
              isDisabled,
            );

            return `
            <div class="free-sample-item">
              <a href="/products/${product.handle}" >
                <img src="${product.images?.[0]?.src || ""}" alt="${product.title}">
              </a>
              <p style="flex-grow:1; margin:5px 0; font-weight:500; font-size:14px;">${product.title}</p>
              <button class="add-free-sample-btn" data-variant-id="${variantId}" ${isDisabled ? "disabled" : ""} style="background:${isDisabled ? "#ccc" : "#000000"}; color:#ffffff; padding:8px 12px; border:none; border-radius:5px; cursor:${isDisabled ? "not-allowed" : "pointer"}; font-size:14px; width:100%; max-width:120px;">
                ${isInCart ? "Added ✓" : "Add to Cart"}
              </button>
              ${!isThresholdMet ? `<p style="font-size:12px; color:#666; margin:5px 0;">Add $${threshold} more to unlock</p>` : ""}
            </div>
          `;
          })
          .join("")}
      </div>
    `;

      // Add event listeners - MODIFIED FOR PAGE RELOAD
      const addButtons = productsContainer.querySelectorAll(
        ".add-free-sample-btn:not([disabled])",
      );
      console.log("🔘 Add buttons found:", addButtons.length);

      addButtons.forEach((btn) => {
        btn.addEventListener("click", async (e) => {
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

            // ✅ RELOAD THE WHOLE PAGE instead of refreshing just the component
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

      console.log("✅ Free sample products refreshed");
    } catch (error) {
      console.error("❌ Error refreshing free samples:", error);
    }
  }

  // 🟢 Initialize
  function initialize() {
    console.log("🚀 Initializing cart override...");

    setupUltimateCartOverride();

    // Initial refresh with multiple attempts to disable inputs
    setTimeout(() => {
      refreshFreeSampleProducts();
      disableFreeSampleQuantityInputs();
    }, 1000);

    // Multiple attempts to ensure inputs are disabled
    setTimeout(() => disableFreeSampleQuantityInputs(), 1500);
    setTimeout(() => disableFreeSampleQuantityInputs(), 2000);
    setTimeout(() => disableFreeSampleQuantityInputs(), 3000);
  }

  // Start
  initialize();
});