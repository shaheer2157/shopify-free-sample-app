import { useState, useEffect } from "react";
import { useFetcher, useLoaderData } from "@remix-run/react";
import {
  Page,
  Text,
  Button,
  Card,
  BlockStack,
  InlineStack,
  Modal,
  TextField,
  ResourceList,
  ResourceItem,
  Avatar,
  Spinner,
  ChoiceList,
  Checkbox,
  Thumbnail,
  Badge,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

// ------------------- Loader -------------------
export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  // Fetch 'free-sample' products and metafields
  const query = await admin.graphql(`
    query {
      products(first: 50, query: "tag:free-sample") {
        edges {
          node {
            id
            title
            handle
            tags
            featuredImage {
              url
            }
          }
        }
      }
      shop {
        metafields(first: 10, namespace: "free_sample_settings") {
          edges {
            node {
              key
              value
            }
          }
        }
      }
    }
  `);

  const response = await query.json();

  const freeSampleProducts = response.data.products.edges.map((edge) => edge.node);
  const metafields = response.data.shop.metafields.edges.reduce((acc, edge) => {
    acc[edge.node.key] = edge.node.value;
    return acc;
  }, {});

  return {
    freeSampleProducts,
    savedThreshold: metafields.threshold || "100",
    savedProductLimit: metafields.product_limit || "2",
  };
};

// ------------------- Action -------------------
export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const type = formData.get("type");

  // --- Save threshold & product limit metafields ---
  if (type === "saveSettings") {
    const threshold = formData.get("threshold");
    const productLimit = formData.get("productLimit");

    // Get shop ID
    const shopQuery = await admin.graphql(`
      query {
        shop {
          id
        }
      }
    `);
    const shopData = await shopQuery.json();
    const shopId = shopData.data.shop.id;

    // Save metafields
    const saveMutation = `
      mutation saveFreeSampleSettings($threshold: String!, $productLimit: String!, $shopId: ID!) {
        metafieldsSet(metafields: [
          {
            namespace: "free_sample_settings"
            key: "threshold"
            type: "single_line_text_field"
            value: $threshold
            ownerId: $shopId
          },
          {
            namespace: "free_sample_settings"
            key: "product_limit"
            type: "single_line_text_field"
            value: $productLimit
            ownerId: $shopId
          }
        ]) {
          metafields {
            key
            value
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    await admin.graphql(saveMutation, {
      variables: { threshold, productLimit, shopId },
    });

    return { success: true };
  }

  // --- Product Search ---
  if (type === "search" || type === "getAll") {
    const query = type === "search" ? formData.get("query") : "";
    const searchRes = await admin.graphql(
      `
        query searchProducts($query: String!) {
          products(first: 20, query: $query) {
            edges {
              node {
                id
                title
                handle
                tags
                featuredImage {
                  url
                }
              }
            }
          }
        }
      `,
      { variables: { query } }
    );

    const data = await searchRes.json();
    return {
      products: data.data.products.edges.map((edge) => edge.node),
    };
  }

  // --- Tag Update ---
  if (type === "updateTag") {
    const id = formData.get("id");
    const add = formData.get("add") === "true";
    const currentTags = JSON.parse(formData.get("tags"));

    let newTags = add
      ? [...new Set([...currentTags, "free-sample"])]
      : currentTags.filter((t) => t !== "free-sample");

    const updateMutation = `
      mutation updateProductTags($id: ID!, $tags: [String!]!) {
        productUpdate(input: { id: $id, tags: $tags }) {
          product {
            id
            tags
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    await admin.graphql(updateMutation, { variables: { id, tags: newTags } });
    return { success: true };
  }

  return null;
};

// ------------------- Component -------------------
export default function Index() {
  const fetcher = useFetcher();
  const { freeSampleProducts, savedThreshold, savedProductLimit } = useLoaderData();

  const [modalActive, setModalActive] = useState(false);
  const [modalSearchValue, setModalSearchValue] = useState("");
  const [selectedProducts, setSelectedProducts] = useState(freeSampleProducts || []);
  const [offerType, setOfferType] = useState(["specific"]);
  const [hideInCart, setHideInCart] = useState(false);
  const [threshold, setThreshold] = useState(savedThreshold || "100");
  const [productLimit, setProductLimit] = useState(savedProductLimit || "2");
  const [modalProducts, setModalProducts] = useState([]);

  // --- Load products in modal ---
  useEffect(() => {
    if (modalActive && !fetcher.data) {
      fetcher.submit({ type: "getAll" }, { method: "POST" });
    }
  }, [modalActive]);

  useEffect(() => {
    if (fetcher.data?.products?.length) {
      setModalProducts(fetcher.data.products);
    }
  }, [fetcher.data]);

  const toggleModal = () => setModalActive(!modalActive);

  const handleSaveSettings = () => {
    fetcher.submit(
      {
        type: "saveSettings",
        threshold,
        productLimit,
      },
      { method: "POST" }
    );
  };

  const handleProductClick = (product) => {
    if (!selectedProducts.find((p) => p.id === product.id)) {
      setSelectedProducts([...selectedProducts, product]);
      setModalProducts(
        modalProducts.map((p) =>
          p.id === product.id
            ? { ...p, tags: [...(p.tags || []), "free-sample"] }
            : p
        )
      );

      fetcher.submit(
        {
          type: "updateTag",
          id: product.id,
          add: "true",
          tags: JSON.stringify(product.tags || []),
        },
        { method: "POST" }
      );
    }
  };

  const handleRemoveProduct = (product) => {
    setSelectedProducts(selectedProducts.filter((p) => p.id !== product.id));

    setModalProducts(
      modalProducts.map((p) =>
        p.id === product.id
          ? { ...p, tags: p.tags?.filter((t) => t !== "free-sample") }
          : p
      )
    );

    fetcher.submit(
      {
        type: "updateTag",
        id: product.id,
        add: "false",
        tags: JSON.stringify(product.tags || []),
      },
      { method: "POST" }
    );
  };

  const filteredProducts = modalProducts.filter((product) =>
    product.title.toLowerCase().includes(modalSearchValue.toLowerCase())
  );

  return (
    <Page>
      <TitleBar title="Free Sample Product Selector" />
      <BlockStack gap="400">
        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd">Offer Settings</Text>
            <Text tone="subdued">
              Products tagged <b>free-sample</b> appear in the free sample widget.
            </Text>

            <TextField
              label="Threshold Price (Subtotal required)"
              type="number"
              value={threshold}
              onChange={setThreshold}
              autoComplete="off"
              helpText="Customers must reach this subtotal to unlock free samples."
            />

            <TextField
              label="Product Add Limit (Max Free Samples)"
              type="number"
              value={productLimit}
              onChange={setProductLimit}
              autoComplete="off"
              helpText="Maximum number of free samples a customer can add."
            />

            <Button onClick={handleSaveSettings} primary>
              Save Settings
            </Button>

            <ChoiceList
              title=""
              choices={[
                { label: "Specific products", value: "specific" },
                { label: "Frequently bought together", value: "frequent" },
              ]}
              selected={offerType}
              onChange={setOfferType}
            />

            {offerType.includes("specific") && (
              <BlockStack gap="200">
                <InlineStack gap="200" blockAlign="center">
                  <div style={{ flex: 1 }}>
                    <TextField
                      label="Search products"
                      labelHidden
                      value=""
                      placeholder="Type product name..."
                      onFocus={() => setModalActive(true)}
                      autoComplete="off"
                    />
                  </div>
                  <Button onClick={toggleModal}>Browse</Button>
                </InlineStack>

                {selectedProducts.length > 0 && (
                  <BlockStack gap="200">
                    {selectedProducts.map((product) => (
                      <InlineStack
                        key={product.id}
                        align="space-between"
                        blockAlign="center"
                        gap="200"
                      >
                        <InlineStack gap="200" blockAlign="center">
                          <Thumbnail
                            source={product.featuredImage?.url}
                            alt={product.title}
                            size="small"
                          />
                          <Text>{product.title}</Text>
                          {product.tags?.includes("free-sample") && (
                            <Badge tone="success">Free Sample</Badge>
                          )}
                        </InlineStack>
                        <Button onClick={() => handleRemoveProduct(product)} plain>
                          ✕
                        </Button>
                      </InlineStack>
                    ))}
                  </BlockStack>
                )}
              </BlockStack>
            )}

            <BlockStack gap="100">
              <Text variant="headingMd">Offer visibility</Text>
              <Checkbox
                label="Hide products that are already in cart"
                checked={hideInCart}
                onChange={setHideInCart}
              />
            </BlockStack>
          </BlockStack>
        </Card>
      </BlockStack>

      <Modal
        open={modalActive}
        onClose={toggleModal}
        title="Browse Products"
        primaryAction={{
          content: "Close",
          onAction: toggleModal,
        }}
      >
        <Modal.Section>
          <BlockStack gap="300">
            <TextField
              label="Search products"
              labelHidden
              value={modalSearchValue}
              onChange={setModalSearchValue}
              placeholder="Type product name..."
              autoComplete="off"
            />

            {fetcher.state === "submitting" ? (
              <Spinner accessibilityLabel="Loading products" size="large" />
            ) : (
              <>
                {filteredProducts.length > 0 ? (
                  <ResourceList
                    resourceName={{ singular: "product", plural: "products" }}
                    items={filteredProducts}
                    renderItem={(product) => {
                      const { id, title, featuredImage, tags } = product;
                      const isSelected = selectedProducts.some((p) => p.id === id);
                      return (
                        <ResourceItem
                          id={id}
                          media={
                            <Avatar
                              customer
                              size="medium"
                              name={title}
                              source={featuredImage?.url}
                            />
                          }
                          accessibilityLabel={`Select ${title}`}
                          onClick={() => handleProductClick(product)}
                          disabled={isSelected}
                        >
                          <InlineStack gap="100" blockAlign="center">
                            <Text variant="bodyMd" fontWeight="bold" as="h3">
                              {title}
                            </Text>
                            {tags?.includes("free-sample") && (
                              <Badge tone="success">Free Sample</Badge>
                            )}
                          </InlineStack>
                        </ResourceItem>
                      );
                    }}
                  />
                ) : (
                  <Text>No products found.</Text>
                )}
              </>
            )}
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
