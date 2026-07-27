-- +goose Up
-- Variant deletion is valid only before inventory becomes part of the audit
-- trail. Prevent product graph replacement from cascading stock or movements.
ALTER TABLE inventory
    DROP CONSTRAINT inventory_product_variant_id_fkey,
    ADD CONSTRAINT inventory_product_variant_id_fkey
        FOREIGN KEY (product_variant_id) REFERENCES product_variants(id) ON DELETE RESTRICT;

ALTER TABLE inventory_movements
    DROP CONSTRAINT inventory_movements_product_variant_id_fkey,
    ADD CONSTRAINT inventory_movements_product_variant_id_fkey
        FOREIGN KEY (product_variant_id) REFERENCES product_variants(id) ON DELETE RESTRICT;

-- +goose Down
ALTER TABLE inventory_movements
    DROP CONSTRAINT inventory_movements_product_variant_id_fkey,
    ADD CONSTRAINT inventory_movements_product_variant_id_fkey
        FOREIGN KEY (product_variant_id) REFERENCES product_variants(id) ON DELETE CASCADE;

ALTER TABLE inventory
    DROP CONSTRAINT inventory_product_variant_id_fkey,
    ADD CONSTRAINT inventory_product_variant_id_fkey
        FOREIGN KEY (product_variant_id) REFERENCES product_variants(id) ON DELETE CASCADE;
