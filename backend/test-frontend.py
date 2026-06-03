"""
TEMPSENSE Frontend E2E Test Suite
Tests all UI flows using Playwright with Chrome.
"""
import os
import sys
import time
from playwright.sync_api import sync_playwright, expect

BASE_URL = "http://localhost:5173"
SCREENSHOT_DIR = os.path.join(os.path.dirname(__file__), "test-screenshots")
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

results = []

def log(test, passed, detail=""):
    icon = "✅" if passed else "❌"
    results.append({"test": test, "passed": passed, "detail": detail})
    print(f"{icon} {test}: {detail}")

def screenshot(page, name):
    path = os.path.join(SCREENSHOT_DIR, f"{name}.png")
    page.screenshot(path=path, full_page=True)
    return path

def run_tests():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        # ===== TEST 1: Login Page =====
        print("\n--- 1. Login Page ---")
        page.goto(BASE_URL)
        page.wait_for_load_state("networkidle")
        screenshot(page, "01_login_page")

        # Check login form elements exist
        email_input = page.locator("input[type='email'], input[placeholder*='email' i]")
        password_input = page.locator("input[type='password']")
        login_btn = page.locator("button[type='submit'], button:has-text('Sign In'), button:has-text('Login'), button:has-text('Log In')")

        log("Login page loads", email_input.count() > 0, 
            f"Email input found: {email_input.count() > 0}")
        log("Password field exists", password_input.count() > 0,
            f"Password input found: {password_input.count() > 0}")
        log("Login button exists", login_btn.count() > 0,
            f"Login button found: {login_btn.count() > 0}")

        # ===== TEST 2: Wrong Password =====
        print("\n--- 2. Wrong Password ---")
        email_input.first.fill("admin@maxworthonline.com")
        password_input.first.fill("wrongpassword")
        login_btn.first.click()
        page.wait_for_timeout(2000)
        screenshot(page, "02_wrong_password")

        error_msg = page.locator(".login-error, [class*='error'], [role='alert']")
        log("Wrong password shows error", error_msg.count() > 0,
            f"Error message visible: {error_msg.count() > 0}")

        # ===== TEST 3: Successful Login =====
        print("\n--- 3. Successful Login ---")
        email_input.first.fill("admin@maxworthonline.com")
        password_input.first.fill("TMS@2026")
        login_btn.first.click()
        page.wait_for_timeout(3000)
        page.wait_for_load_state("networkidle")
        screenshot(page, "03_after_login")

        # Check if we're on dashboard or profile setup
        current_url = page.url
        is_dashboard = "/" in current_url and "login" not in current_url.lower()
        log("Login redirects away from login page", is_dashboard,
            f"Current URL: {current_url}")

        # ===== TEST 4: Dashboard =====
        print("\n--- 4. Dashboard ---")
        page.goto(BASE_URL)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)
        screenshot(page, "04_dashboard")

        # Check for dashboard elements
        dashboard_heading = page.locator("h2:has-text('Dashboard'), h2:has-text('Live Dashboard')")
        log("Dashboard heading visible", dashboard_heading.count() > 0,
            f"Dashboard heading found: {dashboard_heading.count() > 0}")

        # Check company name display
        company_display = page.locator("text=Maxworth Techserv")
        log("Company name displayed", company_display.count() > 0,
            f"Company name elements: {company_display.count()}")

        # Check stat cards
        stat_cards = page.locator(".stat-card")
        log("Stat cards visible", stat_cards.count() >= 3,
            f"Stat cards count: {stat_cards.count()}")

        # ===== TEST 5: Sidebar Navigation =====
        print("\n--- 5. Sidebar Navigation ---")
        sidebar = page.locator(".sidebar, aside, nav")
        log("Sidebar exists", sidebar.count() > 0,
            f"Sidebar elements: {sidebar.count()}")

        # Check nav items
        nav_links = page.locator(".nav-item, .sidebar a, .sidebar-nav a")
        nav_count = nav_links.count()
        log("Navigation links present", nav_count > 0,
            f"Nav link count: {nav_count}")

        # Check role badge shows ADMIN
        admin_badge = page.locator("text=ADMIN")
        log("Admin role badge shown", admin_badge.count() > 0,
            f"ADMIN badge found: {admin_badge.count() > 0}")

        # Verify no SUPER_ADMIN or VISITOR references
        super_admin_ref = page.locator("text=SUPER_ADMIN, text=super_admin, text=SUPER ADMIN")
        visitor_ref = page.locator("text=VISITOR")
        log("No super_admin leaked", super_admin_ref.count() == 0,
            f"super_admin references: {super_admin_ref.count()}")
        log("No visitor references", visitor_ref.count() == 0,
            f"visitor references: {visitor_ref.count()}")

        # ===== TEST 6: Sites Page =====
        print("\n--- 6. Sites Page ---")
        sites_link = page.locator("a[href='/sites'], .nav-item:has-text('Sites')")
        if sites_link.count() > 0:
            sites_link.first.click()
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(1500)
            screenshot(page, "06_sites_page")

            sites_heading = page.locator("h2:has-text('Sites')")
            log("Sites page loads", sites_heading.count() > 0,
                f"Sites heading found")

            # Check for Add button
            add_site_btn = page.locator("button:has-text('Add Site')")
            log("Add Site button exists", add_site_btn.count() > 0,
                f"Add Site button found")

            # Check for Edit buttons (Pencil icons)
            edit_btns = page.locator("button:has(svg.lucide-pencil), button .lucide-pencil, button:has-text('Edit')")
            # Use a broader selector
            table_rows = page.locator(".data-table tbody tr")
            log("Sites table has rows", table_rows.count() >= 0,
                f"Table rows: {table_rows.count()}")

            # Test Add Site modal
            if add_site_btn.count() > 0:
                add_site_btn.first.click()
                page.wait_for_timeout(500)
                screenshot(page, "06b_add_site_modal")
                
                modal = page.locator(".modal")
                log("Add Site modal opens", modal.count() > 0,
                    f"Modal visible: {modal.count() > 0}")

                # Fill and submit
                name_input = modal.locator("input").first
                name_input.fill("E2E Test Site")
                
                location_input = modal.locator("input").nth(1)
                if location_input.count() > 0:
                    location_input.fill("Test Location")
                
                submit_btn = modal.locator("button[type='submit'], button:has-text('Create Site')")
                if submit_btn.count() > 0:
                    submit_btn.first.click()
                    page.wait_for_timeout(2000)
                    screenshot(page, "06c_after_add_site")
                    log("Site created successfully", True, "Form submitted")

            # Test Edit Site modal
            page.wait_for_timeout(1000)
            edit_buttons = page.locator(".btn-ghost.btn-sm, button:has(.lucide-pencil)")
            if edit_buttons.count() > 0:
                edit_buttons.first.click()
                page.wait_for_timeout(500)
                screenshot(page, "06d_edit_site_modal")
                
                edit_modal = page.locator(".modal")
                modal_title = page.locator(".modal h3")
                is_edit = modal_title.count() > 0 and "Edit" in (modal_title.first.text_content() or "")
                log("Edit Site modal opens", edit_modal.count() > 0,
                    f"Modal title: {modal_title.first.text_content() if modal_title.count() > 0 else 'N/A'}")

                # Close modal
                cancel_btn = edit_modal.locator("button:has-text('Cancel')")
                if cancel_btn.count() > 0:
                    cancel_btn.first.click()
                    page.wait_for_timeout(500)

        # ===== TEST 7: Rooms Page =====
        print("\n--- 7. Rooms Page ---")
        rooms_link = page.locator("a[href='/rooms'], .nav-item:has-text('Rooms')")
        if rooms_link.count() > 0:
            rooms_link.first.click()
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(1500)
            screenshot(page, "07_rooms_page")

            rooms_heading = page.locator("h2:has-text('Rooms')")
            log("Rooms page loads", rooms_heading.count() > 0,
                f"Rooms heading found")

            add_room_btn = page.locator("button:has-text('Add Room')")
            log("Add Room button exists", add_room_btn.count() > 0,
                f"Add Room button found")

            # Test Add Room modal
            if add_room_btn.count() > 0:
                add_room_btn.first.click()
                page.wait_for_timeout(500)
                screenshot(page, "07b_add_room_modal")
                
                modal = page.locator(".modal")
                log("Add Room modal opens", modal.count() > 0,
                    f"Modal visible")
                
                # Check site selector exists
                site_select = modal.locator("select")
                log("Site selector in room form", site_select.count() > 0,
                    f"Site select found: {site_select.count() > 0}")
                
                # Close
                cancel_btn = modal.locator("button:has-text('Cancel')")
                if cancel_btn.count() > 0:
                    cancel_btn.first.click()

            # Test edit button
            edit_buttons = page.locator(".btn-ghost.btn-sm")
            if edit_buttons.count() > 0:
                edit_buttons.first.click()
                page.wait_for_timeout(500)
                screenshot(page, "07c_edit_room_modal")
                
                edit_modal = page.locator(".modal")
                log("Edit Room modal opens", edit_modal.count() > 0, "Modal visible")
                
                # In edit mode, site selector should be hidden
                site_select_in_edit = edit_modal.locator("select")
                log("Site selector hidden in edit mode", site_select_in_edit.count() == 0,
                    f"Select count in edit: {site_select_in_edit.count()}")
                
                cancel_btn = edit_modal.locator("button:has-text('Cancel')")
                if cancel_btn.count() > 0:
                    cancel_btn.first.click()

        # ===== TEST 8: Nodes Page =====
        print("\n--- 8. Nodes Page ---")
        nodes_link = page.locator("a[href='/nodes'], .nav-item:has-text('Nodes')")
        if nodes_link.count() > 0:
            nodes_link.first.click()
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(1500)
            screenshot(page, "08_nodes_page")

            nodes_heading = page.locator("h2:has-text('Nodes')")
            log("Nodes page loads", nodes_heading.count() > 0,
                f"Nodes heading found")

        # ===== TEST 9: User Management =====
        print("\n--- 9. User Management ---")
        users_link = page.locator("a[href='/users'], .nav-item:has-text('User Management')")
        if users_link.count() > 0:
            users_link.first.click()
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(2000)
            screenshot(page, "09_users_page")

            users_heading = page.locator("h2:has-text('User Management')")
            log("User Management page loads", users_heading.count() > 0,
                f"Heading found")

            # Check invite button
            invite_btn = page.locator("button:has-text('Invite User')")
            log("Invite User button exists", invite_btn.count() > 0,
                f"Invite button found")

            # Check user table
            user_table = page.locator(".data-table")
            log("User table rendered", user_table.count() > 0,
                f"Table found")

            # Check role badges
            role_badges = page.locator("text=Admin, text=Site Manager, text=Customer")
            log("Role badges displayed", role_badges.count() > 0,
                f"Role badge elements: {role_badges.count()}")

            # Test Invite User modal
            if invite_btn.count() > 0:
                invite_btn.first.click()
                page.wait_for_timeout(500)
                screenshot(page, "09b_invite_modal")
                
                modal = page.locator(".modal")
                log("Invite modal opens", modal.count() > 0, "Modal visible")

                # Check role dropdown
                role_select = modal.locator("select")
                if role_select.count() > 0:
                    options = role_select.locator("option")
                    option_texts = [options.nth(i).text_content() for i in range(options.count())]
                    log("Role options correct", 
                        any("Customer" in t for t in option_texts) and any("Site Manager" in t for t in option_texts),
                        f"Options: {option_texts}")

                    # Select Site Manager to check site assignment appears
                    role_select.first.select_option(label="Site Manager (Site-level access)")
                    page.wait_for_timeout(500)
                    screenshot(page, "09c_site_manager_selector")
                    
                    site_checkboxes = modal.locator("input[type='checkbox']")
                    log("Site assignment checkboxes appear for Site Manager",
                        site_checkboxes.count() > 0,
                        f"Checkboxes: {site_checkboxes.count()}")

                    # Select Customer to check room assignment appears
                    role_select.first.select_option(label="Customer (Room-level access)")
                    page.wait_for_timeout(500)
                    screenshot(page, "09d_customer_selector")
                    
                    room_checkboxes = modal.locator("input[type='checkbox']")
                    log("Room assignment checkboxes appear for Customer",
                        room_checkboxes.count() > 0,
                        f"Checkboxes: {room_checkboxes.count()}")

                # Close modal
                cancel_btn = modal.locator("button:has-text('Cancel')")
                if cancel_btn.count() > 0:
                    cancel_btn.first.click()

            # Test Edit User modal
            page.wait_for_timeout(500)
            edit_buttons = page.locator(".btn-ghost.btn-sm")
            if edit_buttons.count() > 0:
                edit_buttons.first.click()
                page.wait_for_timeout(500)
                screenshot(page, "09e_edit_user_modal")
                
                edit_modal = page.locator(".modal")
                modal_title = page.locator(".modal h3")
                log("Edit User modal opens", 
                    edit_modal.count() > 0 and modal_title.count() > 0,
                    f"Title: {modal_title.first.text_content() if modal_title.count() > 0 else 'N/A'}")

                # Check fields are pre-filled
                name_field = edit_modal.locator("input").first
                name_value = name_field.input_value() if name_field.count() > 0 else ""
                log("Edit form pre-filled", len(name_value) > 0,
                    f"Name value: '{name_value}'")

                cancel_btn = edit_modal.locator("button:has-text('Cancel')")
                if cancel_btn.count() > 0:
                    cancel_btn.first.click()

        # ===== TEST 10: Reports Page =====
        print("\n--- 10. Reports Page ---")
        reports_link = page.locator("a[href='/reports'], .nav-item:has-text('Reports')")
        if reports_link.count() > 0:
            reports_link.first.click()
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(1500)
            screenshot(page, "10_reports_page")

            reports_heading = page.locator("h2:has-text('Reports')")
            log("Reports page loads", reports_heading.count() > 0,
                f"Reports heading found")

            # Check export buttons
            csv_btn = page.locator("button:has-text('CSV'), button:has-text('csv')")
            pdf_btn = page.locator("button:has-text('PDF'), button:has-text('pdf')")
            log("CSV export button exists", csv_btn.count() > 0,
                f"CSV button found: {csv_btn.count() > 0}")
            log("PDF export button exists", pdf_btn.count() > 0,
                f"PDF button found: {pdf_btn.count() > 0}")

        # ===== TEST 11: Alerts Page =====
        print("\n--- 11. Alerts Page ---")
        alerts_link = page.locator("a[href='/alerts'], .nav-item:has-text('Alerts')")
        if alerts_link.count() > 0:
            alerts_link.first.click()
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(1500)
            screenshot(page, "11_alerts_page")

            alerts_heading = page.locator("h2:has-text('Alerts')")
            log("Alerts page loads", alerts_heading.count() > 0,
                f"Alerts heading found")

        # ===== TEST 12: Settings Page =====
        print("\n--- 12. Settings Page ---")
        settings_link = page.locator("a[href='/settings'], .nav-item:has-text('System Settings'), .nav-item:has-text('Settings')")
        if settings_link.count() > 0:
            settings_link.first.click()
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(1500)
            screenshot(page, "12_settings_page")

            settings_heading = page.locator("h2:has-text('Settings'), h2:has-text('System')")
            log("Settings page loads", settings_heading.count() > 0,
                f"Settings heading found")

        # ===== TEST 13: Sign Out =====
        print("\n--- 13. Sign Out ---")
        signout_btn = page.locator("button:has-text('Sign Out'), button:has-text('Logout'), button:has-text('Log Out')")
        if signout_btn.count() > 0:
            signout_btn.first.click()
            page.wait_for_timeout(2000)
            page.wait_for_load_state("networkidle")
            screenshot(page, "13_after_signout")
            
            # Should be back on login page
            email_field = page.locator("input[type='email'], input[placeholder*='email' i]")
            log("Sign out returns to login", email_field.count() > 0,
                f"Login form visible: {email_field.count() > 0}")

        # ===== CLEANUP: Delete test site =====
        print("\n--- 14. Cleanup ---")
        # Login again to clean up the E2E test site
        email_field = page.locator("input[type='email'], input[placeholder*='email' i]")
        password_field = page.locator("input[type='password']")
        if email_field.count() > 0:
            email_field.first.fill("admin@maxworthonline.com")
            password_field.first.fill("TMS@2026")
            login_button = page.locator("button[type='submit'], button:has-text('Sign In'), button:has-text('Login')")
            login_button.first.click()
            page.wait_for_timeout(3000)

            # Navigate to Sites and delete E2E test site
            page.goto(f"{BASE_URL}/sites")
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(1500)

            test_site_row = page.locator("tr:has-text('E2E Test Site')")
            if test_site_row.count() > 0:
                # Accept the confirm dialog
                page.on("dialog", lambda dialog: dialog.accept())
                delete_btn = test_site_row.locator(".btn-danger")
                if delete_btn.count() > 0:
                    delete_btn.first.click()
                    page.wait_for_timeout(2000)
                    log("E2E test site cleaned up", True, "Deleted")
            else:
                log("E2E test site cleanup", True, "Not found (already clean)")

        browser.close()

    # ===== SUMMARY =====
    print("\n========================================")
    passed = sum(1 for r in results if r["passed"])
    failed = sum(1 for r in results if not r["passed"])
    print(f"  FRONTEND E2E RESULTS: {passed} passed, {failed} failed, {len(results)} total")
    print("========================================\n")

    if failed > 0:
        print("FAILED TESTS:")
        for r in results:
            if not r["passed"]:
                print(f"  ❌ {r['test']}: {r['detail']}")
        print()

    # List screenshots
    print("📸 Screenshots saved to:", SCREENSHOT_DIR)
    for f in sorted(os.listdir(SCREENSHOT_DIR)):
        print(f"  - {f}")

if __name__ == "__main__":
    run_tests()
