import { notFound, redirect } from "next/navigation";

import { JsonLd } from "@/components/json-ld";
import {
  getCategoryBySlug,
  getCategoryTree,
} from "@/features/catalog/categories/api";
import {
  CategoryHero,
  ChildCategories,
} from "@/features/catalog/categories/components/category-hero";
import { CategoryResults } from "@/features/catalog/categories/components/category-results";
import {
  CATEGORY_PAGE_SIZE,
  categoryPageHref,
  categoryPath,
  parseCategoryRouteQuery,
  type CategoryPageSearchParams,
} from "@/features/catalog/categories/routing";
import {
  findCategoryContext,
  getCategoryHref,
} from "@/features/catalog/categories/utils";
import { listProducts } from "@/features/catalog/products/api/public";
import { breadcrumbLd, productListLd } from "@/lib/seo/jsonld";

type CategoryDetailViewProps = {
  params: Promise<{ category: string }>;
  searchParams: CategoryPageSearchParams;
};

export async function CategoryDetailView({
  params,
  searchParams,
}: CategoryDetailViewProps) {
  const [{ category: requestedSlug }, rawSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);
  const query = parseCategoryRouteQuery(rawSearchParams);
  const category = await getCategoryBySlug(requestedSlug);
  if (!category) notFound();

  const tree = await getCategoryTree();

  const canonicalSlug = category.slug?.trim() || requestedSlug;
  const basePath = categoryPath(canonicalSlug);
  if (query.needsRedirect || canonicalSlug !== requestedSlug) {
    redirect(categoryPageHref(basePath, query, query.page));
  }

  const context = findCategoryContext(tree, category.id);
  if (!context) {
    throw new Error(`Category ${category.id} is missing from the public tree`);
  }
  const ancestors = context.ancestors;
  const children = context.category.children ?? [];
  const parent = ancestors.at(-1);

  const data = await listProducts({
    category_id: category.id,
    include_descendants: true,
    page: query.page,
    limit: CATEGORY_PAGE_SIZE,
    ...(query.q ? { search: query.q } : {}),
    sortBy: query.sortBy,
    orderBy: query.orderBy,
  });
  const lastPage =
    data.pagination.total_items === 0
      ? 1
      : Math.max(1, data.pagination.total_pages);
  if (query.page > lastPage) {
    redirect(categoryPageHref(basePath, query, lastPage));
  }

  const breadcrumbItems = [
    { name: "خانه", path: "/" },
    { name: "دسته‌بندی‌ها", path: "/categories" },
    ...ancestors.flatMap((ancestor) => {
      const href = getCategoryHref(ancestor);
      return href ? [{ name: ancestor.title, path: href }] : [];
    }),
    { name: category.title, path: basePath },
  ];
  const firstPosition = (query.page - 1) * CATEGORY_PAGE_SIZE + 1;

  return (
    <>
      <JsonLd
        data={[
          breadcrumbLd(breadcrumbItems),
          productListLd(
            query.q
              ? `نتایج «${query.q}» در ${category.title}`
              : `محصولات ${category.title} و زیرشاخه‌های آن`,
            data.results,
            firstPosition,
          ),
        ]}
      />

      <CategoryHero
        category={category}
        ancestors={ancestors}
        parent={parent}
        childCategories={children}
        totalItems={data.pagination.total_items}
        query={query}
      />

      {children.length ? (
        <ChildCategories categories={children} parentTitle={category.title} />
      ) : null}

      <CategoryResults
        basePath={basePath}
        categoryTitle={category.title}
        query={query}
        pagination={data.pagination}
        products={data.results}
        hasChildren={children.length > 0}
      />
    </>
  );
}
