"""
SceneOS — Midterm Project Review Presentation Generator
Generates a complete, professional, technically accurate PowerPoint deck based on PPT Format.pptx.
"""

import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE

TEMPLATE_PATH = r"C:\Users\Suhaib\Downloads\PPT Format.pptx"
OUTPUT_PATH = r"SceneOS_Midterm_Review.pptx"

# Professional Theme Color Palette
NAVY = RGBColor(15, 23, 42)        # #0f172a - Dark slate/navy for headers
CYAN = RGBColor(2, 132, 199)        # #0284c7 - Cyan/Blue accent
INDIGO = RGBColor(79, 70, 229)      # #4f46e5 - Indigo accent
CHARCOAL = RGBColor(51, 65, 85)     # #334155 - Body text
MUTED = RGBColor(100, 116, 139)     # #64748b - Muted text
EMERALD = RGBColor(5, 150, 105)     # #059669 - Implemented & Verified
AMBER = RGBColor(217, 119, 6)       # #d97706 - Verification Pending
PURPLE = RGBColor(147, 51, 234)     # #9333ea - Planned
CARD_BG = RGBColor(248, 250, 252)   # #f8fafc - Card background
CARD_BORDER = RGBColor(226, 232, 240) # #e2e8f0 - Card border
WHITE = RGBColor(255, 255, 255)
DARK_ROW = RGBColor(241, 245, 249)  # #f1f5f9 - Alternating table row

def clear_shape_text(shape):
    """Safely clear text from a shape without deleting it."""
    if shape.has_text_frame:
        shape.text_frame.text = ""

def remove_placeholder(slide, idx):
    """Safely remove a placeholder shape by index."""
    try:
        sp = slide.placeholders[idx]._element
        sp.getparent().remove(sp)
    except Exception:
        pass

def format_title(shape, text, category="MIDTERM PROJECT REVIEW"):
    """Format standard slide title with optional category tag."""
    tf = shape.text_frame
    tf.word_wrap = True
    tf.margin_left = Inches(0.1)
    tf.margin_top = Inches(0.05)
    tf.margin_right = Inches(0.1)
    tf.margin_bottom = Inches(0.05)
    tf.text = ""
    
    # Category / Tag line
    if category:
        p_cat = tf.paragraphs[0]
        p_cat.text = category.upper()
        p_cat.font.name = "Arial"
        p_cat.font.size = Pt(9.5)
        p_cat.font.bold = True
        p_cat.font.color.rgb = CYAN
        p_cat.space_after = Pt(2)
        p_title = tf.add_paragraph()
    else:
        p_title = tf.paragraphs[0]
        
    p_title.text = text
    p_title.font.name = "Arial"
    p_title.font.size = Pt(21)
    p_title.font.bold = True
    p_title.font.color.rgb = NAVY

def add_card(slide, left, top, width, height, bg_color=CARD_BG, border_color=CARD_BORDER):
    """Add a subtle card container shape."""
    shape = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
    shape.fill.solid()
    shape.fill.fore_color.rgb = bg_color
    shape.line.color.rgb = border_color
    shape.line.width = Pt(1)
    return shape

def add_card_with_header(slide, left, top, width, height, header_text, bullets, accent_color=CYAN, header_size=12.5, bullet_size=10.0, space_after=5, header_space_after=6):
    """Add a card container with header and bullet points."""
    add_card(slide, left, top, width, height)
    
    # Accent top border
    accent = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, left, top, width, Inches(0.06))
    accent.fill.solid()
    accent.fill.fore_color.rgb = accent_color
    accent.line.fill.background()
    
    tb = slide.shapes.add_textbox(left + Inches(0.18), top + Inches(0.12), width - Inches(0.36), height - Inches(0.2))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0
    
    p_head = tf.paragraphs[0]
    p_head.text = header_text
    p_head.font.name = "Arial"
    p_head.font.size = Pt(header_size)
    p_head.font.bold = True
    p_head.font.color.rgb = NAVY
    p_head.space_after = Pt(header_space_after)
    
    for i, (lead, body) in enumerate(bullets):
        p = tf.add_paragraph()
        p.space_after = Pt(space_after)
        
        r1 = p.add_run()
        r1.text = "• " + lead + (" " if lead else "")
        r1.font.name = "Arial"
        r1.font.size = Pt(bullet_size)
        r1.font.bold = True
        r1.font.color.rgb = NAVY if lead else CHARCOAL
        
        r2 = p.add_run()
        r2.text = body
        r2.font.name = "Arial"
        r2.font.size = Pt(bullet_size)
        r2.font.bold = False
        r2.font.color.rgb = CHARCOAL

def main():
    print(f"Loading template: {TEMPLATE_PATH}")
    prs = Presentation(TEMPLATE_PATH)
    
    # Ensure 12 slides: Add Slide 11 before the Thank You slide (Slide 11 in original template)
    new_slide = prs.slides.add_slide(prs.slide_layouts[0])
    sldIdLst = prs.slides._sldIdLst
    sldIdLst.insert(10, sldIdLst[11])
    print(f"Total slides after alignment: {len(prs.slides)}")
    
    # =========================================================================
    # SLIDE 1 — TITLE SLIDE
    # =========================================================================
    s1 = prs.slides[0]
    # Remove all placeholder text
    title_shape = s1.shapes[0]
    tf1 = title_shape.text_frame
    tf1.word_wrap = True
    tf1.text = ""
    
    # 1. Academic Header
    p0 = tf1.paragraphs[0]
    p0.alignment = PP_ALIGN.CENTER
    r = p0.add_run()
    r.text = "DEPARTMENT OF MASTER OF COMPUTER APPLICATIONS\n"
    r.font.name = "Arial"
    r.font.size = Pt(13)
    r.font.bold = True
    r.font.color.rgb = MUTED
    
    r_sub = p0.add_run()
    r_sub.text = "MIDTERM PROJECT REVIEW (2026-2027)\n\n"
    r_sub.font.name = "Arial"
    r_sub.font.size = Pt(11.5)
    r_sub.font.bold = True
    r_sub.font.color.rgb = CYAN
    
    # 2. Main Title
    p1 = tf1.add_paragraph()
    p1.alignment = PP_ALIGN.CENTER
    r_main = p1.add_run()
    r_main.text = "SceneOS\n"
    r_main.font.name = "Arial"
    r_main.font.size = Pt(40)
    r_main.font.bold = True
    r_main.font.color.rgb = NAVY
    
    # 3. Subtitle
    p2 = tf1.add_paragraph()
    p2.alignment = PP_ALIGN.CENTER
    r_subt = p2.add_run()
    r_subt.text = "Intelligent Film Production Planning and Management System\n\n"
    r_subt.font.name = "Arial"
    r_subt.font.size = Pt(17)
    r_subt.font.bold = True
    r_subt.font.color.rgb = CHARCOAL
    
    # 4. Presenter details box
    p3 = tf1.add_paragraph()
    p3.alignment = PP_ALIGN.CENTER
    r_pres = p3.add_run()
    r_pres.text = "Presented by: "
    r_pres.font.name = "Arial"
    r_pres.font.size = Pt(12)
    r_pres.font.color.rgb = MUTED
    
    r_name = p3.add_run()
    r_name.text = "[Presenter Name / Student Name]"
    r_name.font.name = "Arial"
    r_name.font.size = Pt(13)
    r_name.font.bold = True
    r_name.font.color.rgb = NAVY
    
    r_usn = p3.add_run()
    r_usn.text = "   |   USN: [1MS... / USN Placeholder]\n"
    r_usn.font.name = "Arial"
    r_usn.font.size = Pt(12.5)
    r_usn.font.bold = True
    r_usn.font.color.rgb = NAVY

    r_inst = p3.add_run()
    r_inst.text = "Master of Computer Applications  |  Midterm Project Evaluation"
    r_inst.font.name = "Arial"
    r_inst.font.size = Pt(11)
    r_inst.font.color.rgb = MUTED
    
    # =========================================================================
    # SLIDE 2 — PROBLEM STATEMENT
    # =========================================================================
    s2 = prs.slides[1]
    format_title(s2.shapes[0], "Problem Statement: Film Production Coordination Gaps")
    remove_placeholder(s2, 1)
    
    # 3 Analytical Cards
    card_w = Inches(2.88)
    card_h = Inches(3.25)
    top_pos = Inches(1.72)
    
    # Card 1
    add_card_with_header(
        s2, Inches(0.43), top_pos, card_w, card_h,
        "1. Departmental Complexity",
        [
            ("Massive Stakeholder Grid:", "Feature productions coordinate 10+ distinct creative departments: Direction, Camera, Art, Grip, Sound, Wardrobe, and Post."),
            ("Resource Constraints:", "Hundreds of scenes, cast members, shooting locations, and costly equipment rentals must synchronize under fixed release deadlines."),
            ("Cascading Failures:", "A single uncommunicated change in scene requirements propagates delays across the entire crew roster.")
        ],
        CYAN,
        header_size=12, bullet_size=9.6, space_after=4, header_space_after=6
    )
    
    # Card 2
    add_card_with_header(
        s2, Inches(3.56), top_pos, card_w, card_h,
        "2. Disconnected Silos",
        [
            ("Fragmented Toolsets:", "Crews operate using ad-hoc combinations of spreadsheet exports, paper stripboards, PDF call sheets, and isolated chat groups."),
            ("Script Version Drift:", "Re-written scenes or re-ordered pages frequently fail to synchronize, causing crews to shoot outdated drafts."),
            ("Zero Central Truth:", "Lack of a unified database prevents production leads from verifying whether technical prerequisites are fulfilled.")
        ],
        INDIGO,
        header_size=12, bullet_size=9.6, space_after=4, header_space_after=6
    )
    
    # Card 3
    add_card_with_header(
        s2, Inches(6.69), top_pos, card_w, card_h,
        "3. Regulatory & Fiscal Risk",
        [
            ("Indian Guild Guardrails:", "Unions (FWICE, FEFSI) strictly enforce 12-hour turnaround rest intervals, 54-hour weekend breaks, and meal interval caps."),
            ("Overtime Penalties:", "Accidental rest violations trigger union disputes, set halts, and steep financial penalties."),
            ("Completion Bond Vulnerability:", "Unmonitored schedule slippage exhausts the mandatory 10% Completion Bond reserve before post-production wraps.")
        ],
        AMBER,
        header_size=12, bullet_size=9.6, space_after=4, header_space_after=6
    )
    
    # Bottom takeaway bar
    bot_box = add_card(s2, Inches(0.43), Inches(5.1), Inches(9.14), Inches(0.38), bg_color=NAVY, border_color=NAVY)
    tb_bot = s2.shapes.add_textbox(Inches(0.55), Inches(5.12), Inches(8.9), Inches(0.34))
    tb_bot.text_frame.word_wrap = True
    tb_bot.text_frame.margin_left = tb_bot.text_frame.margin_top = tb_bot.text_frame.margin_right = tb_bot.text_frame.margin_bottom = 0
    p_b = tb_bot.text_frame.paragraphs[0]
    p_b.alignment = PP_ALIGN.CENTER
    r_b = p_b.add_run()
    r_b.text = "CORE CHALLENGE: Production management lacks a single-source operating system that directly couples screenplay data with union safety rules and schedule telemetry."
    r_b.font.name = "Arial"
    r_b.font.size = Pt(9.5)
    r_b.font.bold = True
    r_b.font.color.rgb = WHITE

    # =========================================================================
    # SLIDE 3 — PROJECT OBJECTIVES & PROPOSED SOLUTION
    # =========================================================================
    s3 = prs.slides[2]
    format_title(s3.shapes[0], "Project Objectives & Proposed Solution")
    remove_placeholder(s3, 1)
    
    # Left Box: Proposed Solution (SceneOS)
    col1_w = Inches(4.35)
    col2_w = Inches(4.60)
    
    add_card_with_header(
        s3, Inches(0.43), top_pos, col1_w, Inches(3.25),
        "Proposed Solution: SceneOS Platform",
        [
            ("Unified Operating System:", "SceneOS is an intelligent film production management system engineered for producers, directors, and department heads."),
            ("Single Source of Truth:", "Replaces disconnected documents by unifying screenplay breakdown, resource allocation, union compliance, and calendar scheduling."),
            ("Cinematic Instrumentation:", "Features a curved holographic Command Surface HUD with real-time countdown clocks, speedometer dials, and milestone tracking."),
            ("Strict RBAC & Governance:", "Separates system security credentials (Admin, Editor, Viewer) from operational film roles (Director, DoP, Line Producer).")
        ],
        CYAN,
        header_size=12, bullet_size=9.8, space_after=4, header_space_after=6
    )
    
    # Right Box: Principal Objectives
    add_card_with_header(
        s3, Inches(4.97), top_pos, col2_w, Inches(3.25),
        "Principal Engineering Objectives",
        [
            ("Deterministic Screenplay Parsing:", "Ingest industry formats (.fdx, .fountain, .pdf, .docx, .rtf) with automated Hollywood eighths calculation and stable scene IDs (scn-xxx)."),
            ("Regulatory Guild Safety Automation:", "Implement a centralized 11-rule Indian Guild compliance engine (FWICE, FEFSI) with zero duplicate ad-hoc calculations."),
            ("Mathematical Schedule Telemetry:", "Compute real-time velocity, schedule drift, and 10% Completion Bond reserve burn rates."),
            ("Cold-Storage Asset Verification:", "Maintain immutable screenplay freezes and digital camera card offload logs with MD5 checksum tracking.")
        ],
        INDIGO,
        header_size=12, bullet_size=9.8, space_after=4, header_space_after=6
    )
    
    # Bottom Boundary Note
    bot_box3 = add_card(s3, Inches(0.43), Inches(5.1), Inches(9.14), Inches(0.38), bg_color=CARD_BG, border_color=CARD_BORDER)
    tb_b3 = s3.shapes.add_textbox(Inches(0.55), Inches(5.12), Inches(8.9), Inches(0.34))
    tb_b3.text_frame.word_wrap = True
    tb_b3.text_frame.margin_left = tb_b3.text_frame.margin_top = tb_b3.text_frame.margin_right = tb_b3.text_frame.margin_bottom = 0
    p_b3 = tb_b3.text_frame.paragraphs[0]
    p_b3.alignment = PP_ALIGN.CENTER
    r_b3 = p_b3.add_run()
    r_b3.text = "SCOPE BOUNDARY: Prototype demonstrates complete 9-workspace client execution, deterministic parsing, and compliance engines; remote cloud PostgreSQL sync and LLM script Q&A represent planned roadmap milestones."
    r_b3.font.name = "Arial"
    r_b3.font.size = Pt(9.5)
    r_b3.font.bold = True
    r_b3.font.color.rgb = CYAN

    # =========================================================================
    # SLIDE 4 — FILM PRODUCTION WORKFLOW
    # =========================================================================
    s4 = prs.slides[3]
    format_title(s4.shapes[0], "Film Production Workflow: Script to Telemetry")
    remove_placeholder(s4, 1)
    
    # Top concise workflow summary
    tb_wf = s4.shapes.add_textbox(Inches(0.43), Inches(1.58), Inches(9.14), Inches(0.40))
    tf_wf = tb_wf.text_frame
    tf_wf.word_wrap = True
    tf_wf.margin_left = tf_wf.margin_top = tf_wf.margin_right = tf_wf.margin_bottom = 0
    p_wf = tf_wf.paragraphs[0]
    r_wf = p_wf.add_run()
    r_wf.text = "SceneOS structures the end-to-end filmmaking lifecycle into 6 continuous hand-off phases. Each stage maintains strict domain boundaries while feeding downstream scheduling and analytics engines:"
    r_wf.font.name = "Arial"
    r_wf.font.size = Pt(11)
    r_wf.font.color.rgb = CHARCOAL
    
    # Embed Mermaid rendered workflow diagram (height=3.08 in, width=5.02 in, centered)
    diag_wf_path = "docs/diagrams/sceneos-production-workflow.png"
    if os.path.exists(diag_wf_path):
        s4.shapes.add_picture(diag_wf_path, Inches(2.49), Inches(2.00), height=Inches(3.08))
        
    # Bottom status caption
    tb_wfc = s4.shapes.add_textbox(Inches(0.43), Inches(5.16), Inches(9.14), Inches(0.30))
    p_wfc = tb_wfc.text_frame.paragraphs[0]
    p_wfc.alignment = PP_ALIGN.CENTER
    r_wfc = p_wfc.add_run()
    r_wfc.text = "Implementation Evidence: All 6 workflow stages are implemented and accessible across the 9 canonical workspaces."
    r_wfc.font.name = "Arial"
    r_wfc.font.size = Pt(10)
    r_wfc.font.bold = True
    r_wfc.font.color.rgb = EMERALD

    # =========================================================================
    # SLIDE 5 — TECHNICAL SYSTEM ARCHITECTURE
    # =========================================================================
    s5 = prs.slides[4]
    format_title(s5.shapes[0], "Technical System Architecture: Decoupled 4-Layer Model")
    remove_placeholder(s5, 1)
    
    # Embed Mermaid rendered architecture diagram (height=3.15 in, width=7.11 in, centered)
    diag_arch_path = "docs/diagrams/sceneos-system-architecture.png"
    if os.path.exists(diag_arch_path):
        s5.shapes.add_picture(diag_arch_path, Inches(1.44), Inches(1.68), height=Inches(3.15))
        
    # Legend callout at bottom
    tb_arc = s5.shapes.add_textbox(Inches(0.43), Inches(4.96), Inches(9.14), Inches(0.38))
    p_arc = tb_arc.text_frame.paragraphs[0]
    p_arc.alignment = PP_ALIGN.CENTER
    
    r_l1 = p_arc.add_run()
    r_l1.text = "Architecture Legend:   "
    r_l1.font.name = "Arial"
    r_l1.font.size = Pt(9.5)
    r_l1.font.bold = True
    r_l1.font.color.rgb = NAVY
    
    r_l2 = p_arc.add_run()
    r_l2.text = "■ Solid Cyan: Implemented & Verified   "
    r_l2.font.name = "Arial"
    r_l2.font.size = Pt(9.5)
    r_l2.font.bold = True
    r_l2.font.color.rgb = CYAN
    
    r_l3 = p_arc.add_run()
    r_l3.text = "■ Dashed Amber: Implemented / Pending Cloud Test   "
    r_l3.font.name = "Arial"
    r_l3.font.size = Pt(9.5)
    r_l3.font.bold = True
    r_l3.font.color.rgb = AMBER
    
    r_l4 = p_arc.add_run()
    r_l4.text = "■ Dotted Purple: Planned Services"
    r_l4.font.name = "Arial"
    r_l4.font.size = Pt(9.5)
    r_l4.font.bold = True
    r_l4.font.color.rgb = PURPLE

    # =========================================================================
    # SLIDE 6 — TECHNOLOGIES USED
    # =========================================================================
    s6 = prs.slides[5]
    format_title(s6.shapes[0], "Technologies Used & Integration Stack")
    remove_placeholder(s6, 1)
    
    # Table of genuine technologies
    tech_data = [
        ("UI Framework", "React 19.0 + TypeScript 5.7", "Component lifecycle, strict typing, zero compilation errors", "Implemented & Verified"),
        ("Build System", "Vite 6.4 + ES Modules", "High-speed HMR, Rollup production bundling in 8.84s", "Implemented & Verified"),
        ("UI Styling", "Tailwind CSS 4 + Lucide Icons", "Restrained dark cinematic theme, technical instrumentation icons", "Implemented & Verified"),
        ("Animations", "Motion (motion/react 12.4)", "Hardware-accelerated gauge needles, tab backplates, and modals", "Implemented & Verified"),
        ("Testing Suite", "Vitest 5.0", "Deterministic unit testing for schedulers, compliance, and parsers", "Implemented & Verified"),
        ("Backend Client", "Supabase Client (@supabase/supabase-js)", "PostgreSQL database schemas, GoTrue auth provider hooks", "Implemented / Pending"),
        ("Local Persistence", "Browser LocalStorage + JSON Engine", "Stateful offline persistence, project blueprint backup export/import", "Implemented & Verified"),
        ("Document Parsers", "Custom XML, Fountain, PDF Stream, DOCX", "Deterministic stream extraction & content-hashed scene ID generator", "Implemented & Verified"),
    ]
    
    rows = len(tech_data) + 1
    cols = 4
    table_shape = s6.shapes.add_table(rows, cols, Inches(0.43), Inches(1.65), Inches(9.14), Inches(3.60))
    table = table_shape.table
    
    # Column widths
    table.columns[0].width = Inches(1.70)
    table.columns[1].width = Inches(2.20)
    table.columns[2].width = Inches(3.64)
    table.columns[3].width = Inches(1.60)
    
    # Headers
    headers = ["Domain / Layer", "Technology & Version", "Architectural Role & Purpose", "Integration Status"]
    for c, h in enumerate(headers):
        cell = table.cell(0, c)
        cell.fill.solid()
        cell.fill.fore_color.rgb = NAVY
        p = cell.text_frame.paragraphs[0]
        p.alignment = PP_ALIGN.LEFT
        r = p.add_run()
        r.text = h
        r.font.name = "Arial"
        r.font.size = Pt(10)
        r.font.bold = True
        r.font.color.rgb = WHITE
        cell.margin_left = cell.margin_right = Inches(0.08)
        cell.margin_top = cell.margin_bottom = Inches(0.04)

    # Data Rows
    for r_idx, row in enumerate(tech_data):
        row_bg = DARK_ROW if r_idx % 2 == 1 else WHITE
        for c_idx, val in enumerate(row):
            cell = table.cell(r_idx + 1, c_idx)
            cell.fill.solid()
            cell.fill.fore_color.rgb = row_bg
            p = cell.text_frame.paragraphs[0]
            p.alignment = PP_ALIGN.LEFT
            r = p.add_run()
            r.text = val
            r.font.name = "Arial"
            r.font.size = Pt(9.5)
            r.font.bold = (c_idx == 1)
            
            # Status badge coloring
            if c_idx == 3:
                r.font.bold = True
                if "Verified" in val:
                    r.font.color.rgb = EMERALD
                elif "Pending" in val:
                    r.font.color.rgb = AMBER
                else:
                    r.font.color.rgb = PURPLE
            else:
                r.font.color.rgb = NAVY if c_idx == 0 or c_idx == 1 else CHARCOAL
                
            cell.margin_left = cell.margin_right = Inches(0.08)
            cell.margin_top = cell.margin_bottom = Inches(0.04)

    # =========================================================================
    # SLIDE 7 — DEVELOPMENT METHODOLOGY
    # =========================================================================
    s7 = prs.slides[6]
    format_title(s7.shapes[0], "Development Methodology: Engineering Lifecycle")
    remove_placeholder(s7, 1)
    
    # 5 Process Cards across 2 rows
    # Row 1: 3 cards
    w3 = Inches(2.88)
    h_row1 = Inches(1.58)
    top_r1 = Inches(1.65)
    
    add_card_with_header(
        s7, Inches(0.43), top_r1, w3, h_row1,
        "1. Domain & Format Audit",
        [
            ("Standards Audit:", "Audited Final Draft (.fdx), Fountain, digital vector PDFs, and Word XML screenplay structures."),
            ("Guild Rules Analysis:", "Evaluated FWICE & FEFSI collective agreements for safety rest turnarounds.")
        ],
        CYAN,
        header_size=11.5, bullet_size=9.1, space_after=3, header_space_after=4
    )
    
    add_card_with_header(
        s7, Inches(3.56), top_r1, w3, h_row1,
        "2. Architecture & Contracts",
        [
            ("9 Canonical Workspaces:", "Formalized single-responsibility boundaries mirroring real film workflow order."),
            ("Contract Interfaces:", "Decoupled UI from storage via IAuthService, IProjectService, and IActivityService.")
        ],
        INDIGO,
        header_size=11.5, bullet_size=9.1, space_after=3, header_space_after=4
    )
    
    add_card_with_header(
        s7, Inches(6.69), top_r1, w3, h_row1,
        "3. Core Engine Implementation",
        [
            ("Mathematical Scheduler:", "Built recalculateSchedule and getPipelineMetrics for automated timeline updates."),
            ("Centralized Compliance:", "Engineered 11-point safety evaluator with zero duplicate ad-hoc calculations.")
        ],
        CYAN,
        header_size=11.5, bullet_size=9.1, space_after=3, header_space_after=4
    )
    
    # Row 2: 2 wider cards
    w2 = Inches(4.45)
    h_row2 = Inches(1.65)
    top_r2 = Inches(3.38)
    
    add_card_with_header(
        s7, Inches(0.43), top_r2, w2, h_row2,
        "4. Screenplay Parser Reliability Engineering",
        [
            ("Bounded Stream Extraction:", "Replaced regex-only PDF parsing with a standards-aware vector stream extractor; eliminated infinite loops and stream corruption."),
            ("Stable Scene Identity:", "Engineered deterministic content-hash IDs (scn-xxx) ensuring scene tracking across script draft updates without index collisions.")
        ],
        INDIGO,
        header_size=11.5, bullet_size=9.1, space_after=3, header_space_after=4
    )
    
    add_card_with_header(
        s7, Inches(5.12), top_r2, w2, h_row2,
        "5. Static Verification & Regression Testing",
        [
            ("Automated Test Suites:", "Executed 10 comprehensive test files across schedulers, projects, compliance, and screenplay ingestion (all passing)."),
            ("Build & Type Validation:", "Achieved 0 TypeScript compilation errors (npx tsc --noEmit) and clean production builds (npm run build in 8.84s).")
        ],
        EMERALD,
        header_size=11.5, bullet_size=9.1, space_after=3, header_space_after=4
    )

    # =========================================================================
    # SLIDE 8 — PROTOTYPE DEMONSTRATION
    # =========================================================================
    s8 = prs.slides[7]
    format_title(s8.shapes[0], "Prototype Demonstration: Implemented Workspaces")
    remove_placeholder(s8, 1)
    
    # 3 Genuine Application Screenshots side-by-side
    col_w = Inches(2.92)
    lefts = [Inches(0.43), Inches(3.54), Inches(6.65)]
    shots = [
        ("docs/screenshots/sceneos_auth_portal.png", "1. Welcome & Auth Portal", "Demonstrates entry portal with platform capability highlights, role-based login, and evaluation personas (Director Elena Rostova, Line Producer Marcus Thorne)."),
        ("docs/screenshots/sceneos_overview_dashboard.png", "2. Command Surface (HUD)", "Demonstrates curved holographic production header, live wrap countdown clock, three animated needle gauges (Tasks, Alignment, Velocity), and milestone track."),
        ("docs/screenshots/sceneos_operational_attention.png", "3. Operational Attention & Safety", "Demonstrates real-time operational attention drawer detecting schedule drift (183d overdue), FWICE union safety adherence, and actionable resolution steps.")
    ]
    
    for i, (img_path, title, caption) in enumerate(shots):
        x = lefts[i]
        # Container Card
        add_card(s8, x, Inches(1.60), col_w, Inches(3.68))
        
        # Title
        tb_t = s8.shapes.add_textbox(x + Inches(0.08), Inches(1.65), col_w - Inches(0.16), Inches(0.30))
        p_t = tb_t.text_frame.paragraphs[0]
        r_t = p_t.add_run()
        r_t.text = title
        r_t.font.name = "Arial"
        r_t.font.size = Pt(11)
        r_t.font.bold = True
        r_t.font.color.rgb = NAVY
        
        # Image
        if os.path.exists(img_path):
            s8.shapes.add_picture(img_path, x + Inches(0.08), Inches(2.00), width=col_w - Inches(0.16))
            
        # Caption
        tb_c = s8.shapes.add_textbox(x + Inches(0.08), Inches(3.75), col_w - Inches(0.16), Inches(1.45))
        tf_c = tb_c.text_frame
        tf_c.word_wrap = True
        tf_c.margin_left = tf_c.margin_top = tf_c.margin_right = tf_c.margin_bottom = 0
        p_c = tf_c.paragraphs[0]
        r_c = p_c.add_run()
        r_c.text = caption
        r_c.font.name = "Arial"
        r_c.font.size = Pt(9.5)
        r_c.font.color.rgb = CHARCOAL

    # =========================================================================
    # SLIDE 9 — RESULTS AND CURRENT IMPLEMENTATION STATUS
    # =========================================================================
    s9 = prs.slides[8]
    format_title(s9.shapes[0], "Results and Current Implementation Status")
    remove_placeholder(s9, 1)
    
    results_data = [
        ("Overview Command Surface", "Implemented & Verified", "Curved holographic HUD, wrap countdown clock, 3 animated speedometer dials, milestone track"),
        ("Screenplay & Breakdown Studio", "Implemented & Verified", "Multi-format ingestion (.fdx, .fountain, .pdf, .docx), eighths calculator, scene matrix & element breakdown"),
        ("Indian Guild Compliance Engine", "Implemented & Verified", "11 deterministic safety checks (FWICE, FEFSI); verified via automated test suite (compliance.test.ts)"),
        ("Roadmap & Durations", "Implemented & Verified", "Phase durations (Pre, Prod, Post), interactive day steppers, milestone dependencies, guardrail banners"),
        ("Calendar & Stripboard", "Implemented & Verified", "Shooting calendar and visual stripboard with call-sheet dates, day/night scene tags, and turnarounds"),
        ("Kanban & Crew Directory", "Implemented & Verified", "Phase-segregated Kanban execution columns, operational filmmaking roles, personnel rolodex"),
        ("Production Analytics Workspace", "Implemented & Verified", "Mathematical velocity calculation, 10% Completion Bond reserve monitoring, priority spread"),
        ("Cold-Storage Production Vault", "Implemented & Verified", "MD5 camera card logs, immutable screenplay version snapshots, JSON blueprint backups"),
        ("Automated Test Suite & Build", "Implemented & Verified", "45+ unit/integration tests passing; 0 TypeScript errors (npx tsc --noEmit); production build in 8.84s"),
    ]
    
    table_shape9 = s9.shapes.add_table(len(results_data) + 1, 3, Inches(0.43), Inches(1.62), Inches(9.14), Inches(3.60))
    t9 = table_shape9.table
    t9.columns[0].width = Inches(2.40)
    t9.columns[1].width = Inches(1.80)
    t9.columns[2].width = Inches(4.94)
    
    h9 = ["Production Module / Feature", "Current Status", "Empirical Evidence & Verified Capabilities"]
    for c, h in enumerate(h9):
        cell = t9.cell(0, c)
        cell.fill.solid()
        cell.fill.fore_color.rgb = NAVY
        p = cell.text_frame.paragraphs[0]
        r = p.add_run()
        r.text = h
        r.font.name = "Arial"
        r.font.size = Pt(10)
        r.font.bold = True
        r.font.color.rgb = WHITE
        cell.margin_left = cell.margin_right = Inches(0.08)
        cell.margin_top = cell.margin_bottom = Inches(0.04)

    for r_idx, row in enumerate(results_data):
        row_bg = DARK_ROW if r_idx % 2 == 1 else WHITE
        for c_idx, val in enumerate(row):
            cell = t9.cell(r_idx + 1, c_idx)
            cell.fill.solid()
            cell.fill.fore_color.rgb = row_bg
            p = cell.text_frame.paragraphs[0]
            r = p.add_run()
            r.text = val
            r.font.name = "Arial"
            r.font.size = Pt(9.5)
            r.font.bold = (c_idx == 0 or c_idx == 1)
            if c_idx == 1:
                r.font.color.rgb = EMERALD
            elif c_idx == 0:
                r.font.color.rgb = NAVY
            else:
                r.font.color.rgb = CHARCOAL
            cell.margin_left = cell.margin_right = Inches(0.08)
            cell.margin_top = cell.margin_bottom = Inches(0.04)

    # =========================================================================
    # SLIDE 10 — CURRENT LIMITATIONS
    # =========================================================================
    s10 = prs.slides[9]
    format_title(s10.shapes[0], "Current Limitations & Technical Constraints")
    remove_placeholder(s10, 1)
    
    # 4 Cards in 2x2 Grid
    w4 = Inches(4.45)
    h4 = Inches(1.68)
    
    add_card_with_header(
        s10, Inches(0.43), Inches(1.65), w4, h4,
        "1. Client-Side Execution Footprint",
        [
            ("In-Browser Single Page Application:", "The current prototype operates with local in-memory state and browser LocalStorage caching."),
            ("Scalability Constraint:", "While highly responsive for single-user review, large studio productions with thousands of high-res assets require backend streaming and database clustering.")
        ],
        AMBER,
        header_size=11.5, bullet_size=9.2, space_after=3, header_space_after=4
    )
    
    add_card_with_header(
        s10, Inches(5.12), Inches(1.65), w4, h4,
        "2. Cloud Backend Verification Pending",
        [
            ("Implemented Schema Readiness:", "Supabase PostgreSQL schemas and GoTrue authentication clients are written and integrated in the codebase."),
            ("Remote Testing Scope:", "End-to-end multi-tenant live deployment and concurrent database mutation benchmarks remain to be completed in the next phase.")
        ],
        AMBER,
        header_size=11.5, bullet_size=9.2, space_after=3, header_space_after=4
    )
    
    add_card_with_header(
        s10, Inches(0.43), Inches(3.45), w4, h4,
        "3. Text-Stream PDF Extraction Only",
        [
            ("Vector Text Parsing:", "Screenplay parser reliably handles digital vector stream PDFs with bounded decompression scanners."),
            ("Scanned Document Limitation:", "Photocopied or scanned image-only PDFs without a digital text layer require external OCR (Optical Character Recognition) integration.")
        ],
        AMBER,
        header_size=11.5, bullet_size=9.2, space_after=3, header_space_after=4
    )
    
    add_card_with_header(
        s10, Inches(5.12), Inches(3.45), w4, h4,
        "4. Heuristic vs. Generative AI Breakdown",
        [
            ("Deterministic Rule Heuristics:", "Scene elements (props, vehicles, wardrobe) are tagged via deterministic regex and keyword catalogs."),
            ("Semantic LLM Inference Pending:", "Contextual screenplay understanding (e.g. subtext, stunt danger classification) is architecturally designed but awaits cloud LLM API connectivity.")
        ],
        AMBER,
        header_size=11.5, bullet_size=9.2, space_after=3, header_space_after=4
    )

    # =========================================================================
    # SLIDE 11 — FUTURE SCOPE AND NEXT MILESTONES
    # =========================================================================
    s11 = prs.slides[10]
    format_title(s11.shapes[0], "Future Scope & Next Development Milestones")
    remove_placeholder(s11, 1)
    
    add_card_with_header(
        s11, Inches(0.43), Inches(1.65), w4, h4,
        "Milestone 1: Cloud Backend & Multi-User Sync",
        [
            ("Live Supabase PostgreSQL Deployment:", "Transition from local state to live cloud PostgreSQL tables with Row-Level Security (RLS)."),
            ("Realtime Collaborative Sync:", "Integrate WebSocket event broadcasting for concurrent department edits and live production call sheet updates.")
        ],
        CYAN,
        header_size=11.5, bullet_size=9.2, space_after=3, header_space_after=4
    )
    
    add_card_with_header(
        s11, Inches(5.12), Inches(1.65), w4, h4,
        "Milestone 2: Evidence-Grounded AI Script Intelligence",
        [
            ("Google Gemini API Integration:", "Implement LLM-assisted character arc tracking, emotional pacing graphs, and automated department breakdowns."),
            ("Strict Source-of-Truth Principle:", "Ensure AI assists, tags, and suggests without ever silently modifying the original authorial screenplay.")
        ],
        INDIGO,
        header_size=11.5, bullet_size=9.2, space_after=3, header_space_after=4
    )
    
    add_card_with_header(
        s11, Inches(0.43), Inches(3.45), w4, h4,
        "Milestone 3: Dynamic Multi-Project Conflict Engine",
        [
            ("Cross-Production Leveling:", "Detect cast member, specialist crew, and expensive camera package double-booking across overlapping studio productions."),
            ("Automated Rescheduling:", "Algorithmic schedule rebalancing when weather contingencies or location permit delays occur.")
        ],
        CYAN,
        header_size=11.5, bullet_size=9.2, space_after=3, header_space_after=4
    )
    
    add_card_with_header(
        s11, Inches(5.12), Inches(3.45), w4, h4,
        "Milestone 4: Mobile Call Sheet & Field Crew App",
        [
            ("Offline-First Progressive Web App:", "Lightweight mobile interface for set crews to view daily call sheets, weather alerts, and scene shooting orders."),
            ("Live Wrap Time Reporting:", "Enables 1st ADs to log wrap times directly from set, instantly feeding guild turnaround compliance checks.")
        ],
        INDIGO,
        header_size=11.5, bullet_size=9.2, space_after=3, header_space_after=4
    )

    # =========================================================================
    # SLIDE 12 — CONCLUSION & THANK YOU
    # =========================================================================
    s12 = prs.slides[11]
    # Remove initial Picture 4
    for sp_elem in list(s12.shapes):
        sp = sp_elem._element
        sp.getparent().remove(sp)
        
    title_box12 = s12.shapes.add_textbox(Inches(0.43), Inches(0.95), Inches(9.14), Inches(0.55))
    format_title(title_box12, "Conclusion & Key Contributions", category="MIDTERM EVALUATION")
    
    # Left Box: Summary of verified contribution
    add_card(s12, Inches(0.43), Inches(1.65), Inches(5.40), Inches(3.55))
    tb12 = s12.shapes.add_textbox(Inches(0.60), Inches(1.72), Inches(5.05), Inches(3.40))
    tf12 = tb12.text_frame
    tf12.word_wrap = True
    tf12.margin_left = tf12.margin_top = tf12.margin_right = tf12.margin_bottom = 0
    
    p12_0 = tf12.paragraphs[0]
    p12_0.text = "Key Project Takeaways"
    p12_0.font.name = "Arial"
    p12_0.font.size = Pt(13)
    p12_0.font.bold = True
    p12_0.font.color.rgb = NAVY
    p12_0.space_after = Pt(6)
    
    concl_points = [
        ("Problem Addressed:", "Resolved the fragmentation of film production planning by replacing siloed spreadsheets and paper stripboards with a unified, film-specific command system."),
        ("Proposed Approach:", "Engineered an intelligent platform directly coupling screenplay breakdowns with mathematical scheduling, 11-point Indian Guild compliance, and live telemetry."),
        ("Verified Prototype Contribution:", "Delivered a demonstrable, verified 9-workspace system backed by 10 passing test suites, 0 TypeScript errors, and successful production builds."),
        ("Remaining Priorities:", "Completing live Supabase cloud database synchronization, LLM script analysis, and mobile on-set call sheet PWA interfaces."),
        ("Real-World Impact:", "Provides production houses with a viable digital command center that prevents costly union violations and protects Completion Bond reserves.")
    ]
    
    for lead, body in concl_points:
        p = tf12.add_paragraph()
        p.space_after = Pt(3.5)
        r1 = p.add_run()
        r1.text = "• " + lead + " "
        r1.font.name = "Arial"
        r1.font.size = Pt(9.6)
        r1.font.bold = True
        r1.font.color.rgb = NAVY
        
        r2 = p.add_run()
        r2.text = body
        r2.font.name = "Arial"
        r2.font.size = Pt(9.6)
        r2.font.color.rgb = CHARCOAL
        
    # Right Box: Thank You & Q&A
    add_card(s12, Inches(6.05), Inches(1.65), Inches(3.52), Inches(3.55), bg_color=CARD_BG, border_color=CARD_BORDER)
    
    # Reposition or insert Thank You graphic
    if os.path.exists("slide11_img.png"):
        s12.shapes.add_picture("slide11_img.png", Inches(6.45), Inches(1.85), width=Inches(2.72))
        
    tb_ty = s12.shapes.add_textbox(Inches(6.15), Inches(3.85), Inches(3.32), Inches(1.25))
    tf_ty = tb_ty.text_frame
    tf_ty.word_wrap = True
    tf_ty.margin_left = tf_ty.margin_top = tf_ty.margin_right = tf_ty.margin_bottom = 0
    
    p_ty1 = tf_ty.paragraphs[0]
    p_ty1.alignment = PP_ALIGN.CENTER
    r_ty1 = p_ty1.add_run()
    r_ty1.text = "Questions & Technical Discussion\n"
    r_ty1.font.name = "Arial"
    r_ty1.font.size = Pt(12)
    r_ty1.font.bold = True
    r_ty1.font.color.rgb = NAVY
    
    p_ty2 = tf_ty.add_paragraph()
    p_ty2.alignment = PP_ALIGN.CENTER
    r_ty2 = p_ty2.add_run()
    r_ty2.text = "Department of Master of Computer Applications\nMidterm Review Committee"
    r_ty2.font.name = "Arial"
    r_ty2.font.size = Pt(10.5)
    r_ty2.font.color.rgb = MUTED
    
    # Save the final presentation
    prs.save(OUTPUT_PATH)
    print(f"\nPresentation successfully generated and saved to: {OUTPUT_PATH}")
    print(f"Total slides: {len(prs.slides)}")

if __name__ == "__main__":
    main()
