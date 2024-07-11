"use server";

import { z } from "zod";
import { sql } from "@vercel/postgres";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// Define the shape of the state object
export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
};

// Define the shape of the FormData object
const FormsSchema = z.object({
  id: z.string(),

  customerId: z.string({
    invalid_type_error: "Please select a customer",
  }),

  amount: z.coerce
    .number()
    .gt(0, { message: "Please enter an amount greater than $0." }),

  status: z.enum(["pending", "paid"], {
    invalid_type_error: "Please select an invoice status.",
  }),

  date: z.string(),
});

const UpdateInvoice = FormsSchema.omit({ id: true, date: true });
const CreateInvoice = FormsSchema.omit({ id: true, date: true });

// Create an invoice in the database
export async function createInvoice(prevState: State, formData: FormData) {
  // Validate the fields
  const validatedFields = CreateInvoice.safeParse({
    customerId: formData.get("customerId"),
    amount: formData.get("amount"),
    status: formData.get("status"),
  });

  // If the fields are not valid, return the errors
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Missing Fields. Failed to Create Invoice.",
    };
  }

  // Extract the validated fields
  const { customerId, amount, status } = validatedFields.data;

  const amountInCents = amount * 100;

  const date = new Date().toISOString().split("T")[0];

  // Insert the invoice into the database
  try {
    await sql`
      INSERT INTO invoices (customer_id, amount, status, date)
      VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
    `;
  } catch (error) {
    return {
      message: "Database Error: Failed to Create Invoice.",
    };
  }

  // Revalidate the cache and redirect to the invoices page
  revalidatePath("/dashboard/invoices");
  redirect("/dashboard/invoices");
}

// Update an invoice in the database
export async function updateInvoice(id: string, formData: FormData) {
  const { customerId, amount, status } = UpdateInvoice.parse({
    customerId: formData.get("customerId"),
    amount: formData.get("amount"),
    status: formData.get("status"),
  });

  const amountInCents = amount * 100;

  // Update the invoice in the database
  try {
    await sql`
        UPDATE invoices
        SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
        WHERE id = ${id}
      `;
  } catch (error) {
    return { message: "Database Error: Failed to Update Invoice." };
  }

  // Revalidate the cache and redirect to the invoices page
  revalidatePath("/dashboard/invoices");
  redirect("/dashboard/invoices");
}

// Delete an invoice from the database
export async function deleteInvoice(id: string) {
  throw new Error("Not implemented");

  // Delete the invoice from the database
  try {
    await sql`DELETE FROM invoices WHERE id = ${id}`;
    revalidatePath("/dashboard/invoices");
    return { message: "Deleted Invoice." };
  } catch (error) {
    return { message: "Database Error: Failed to Delete Invoice." };
  }
}
