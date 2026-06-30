from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.pdfgen import canvas
import os
import base64
import io
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Image

class WatermarkCanvas(canvas.Canvas):
    """
    Custom canvas to overlay 'CANCELLED' watermark on pages
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.pages = []
        self.is_cancelled = False
        self.doc_number = ""

    def showPage(self):
        self.pages.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        for page in self.pages:
            self.__dict__.update(page)
            # Draw header and footer
            self.draw_page_decorations()
            if self.is_cancelled:
                self.draw_watermark()
            super().showPage()
        super().save()

    def draw_page_decorations(self):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#718096"))
        # Header
        self.drawString(54, 750, f"Warehouse Operations Management System - {self.doc_number}")
        # Footer
        self.drawRightString(558, 40, f"Page {len(self.pages)}")
        self.drawString(54, 40, "Confidential - For Internal Warehouse Use Only")
        # Line dividers
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.5)
        self.line(54, 742, 558, 742)
        self.line(54, 52, 558, 52)
        self.restoreState()

    def draw_watermark(self):
        self.saveState()
        self.setFont("Helvetica-Bold", 60)
        # Translucent light red color
        self.setFillColorRGB(0.9, 0.2, 0.2, 0.15)
        # Center of the page, rotated diagonally
        self.translate(300, 400)
        self.rotate(45)
        self.drawCentredString(0, 0, "CANCELLED")
        self.restoreState()


def generate_mrf_pdf(mrf_data: dict, file_path: str, cancelled: bool = False):
    """
    Generates a PDF for Material Issuance / Request Form
    """
    def get_val(key, default=""):
        val = mrf_data.get(key)
        return str(val) if val is not None else default

    # Setup document
    doc = SimpleDocTemplate(
        file_path, 
        pagesize=letter,
        rightMargin=54,
        leftMargin=54,
        topMargin=72,
        bottomMargin=72
    )
    
    styles = getSampleStyleSheet()
    
    # Custom Styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#1A365D"),
        spaceAfter=15
    )
    
    section_title_style = ParagraphStyle(
        'SectionTitle',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor("#2C5282"),
        spaceBefore=10,
        spaceAfter=6
    )
    
    normal_style = ParagraphStyle(
        'DocNormal',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#2D3748")
    )
    
    bold_style = ParagraphStyle(
        'DocBold',
        parent=normal_style,
        fontName='Helvetica-Bold'
    )
    
    table_header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=11,
        textColor=colors.white
    )

    company_style = ParagraphStyle(
        'CompanyTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=colors.HexColor("#2C5282")
    )

    story = []

    # Company Logo and Name Header
    logo_base64 = mrf_data.get("company_logo")
    company_name = mrf_data.get("company_name", "WAREHOUSE")
    logo_flowable = None
    if logo_base64:
        try:
            if "," in logo_base64:
                logo_base64 = logo_base64.split(",")[1]
            img_data = base64.b64decode(logo_base64)
            img_buf = io.BytesIO(img_data)
            reader = ImageReader(img_buf)
            w, h = reader.getSize()
            scale = 35.0 / h
            logo_flowable = Image(img_buf, width=w*scale, height=35.0)
        except Exception as e:
            print(f"Failed to generate logo: {e}")

    company_text = Paragraph(company_name, company_style)
    if logo_flowable:
        header_table = Table([[logo_flowable, company_text]], colWidths=[50, 454])
        header_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 10),
        ]))
        story.append(header_table)
    else:
        story.append(company_text)
        story.append(Spacer(1, 10))

    # Title
    story.append(Paragraph("MATERIAL ISSUANCE & REQUEST FORM", title_style))
    story.append(Spacer(1, 10))

    issue_type = get_val("issue_account_type", "project")
    if issue_type == "cost_center":
        account_label = "<b>Cost Center:</b>"
        cc_code = get_val("cost_center_code", "N/A")
        cc_name = get_val("cost_center_name", "")
        account_value = f"{cc_code} - {cc_name}" if cc_name and cc_name != "N/A" else cc_code
        wbs_label = "<b>WBS Element:</b>"
        wbs_value = "N/A"
    else:
        account_label = "<b>Project:</b>"
        account_value = get_val("project_name", "")
        wbs_label = "<b>WBS Element:</b>"
        wbs_value = get_val("wbs_code", "N/A")

    # General info block
    general_info = [
        [
            Paragraph("<b>MRF Number:</b>", normal_style), Paragraph(get_val("reference_number", ""), normal_style),
            Paragraph("<b>Date:</b>", normal_style), Paragraph(get_val("date", ""), normal_style)
        ],
        [
            Paragraph("<b>Requested By:</b>", normal_style), Paragraph(get_val("requested_by_name", ""), normal_style),
            Paragraph("<b>Department:</b>", normal_style), Paragraph(get_val("department_name", "N/A"), normal_style)
        ],
        [
            Paragraph(account_label, normal_style), Paragraph(account_value, normal_style),
            Paragraph(wbs_label, normal_style), Paragraph(wbs_value, normal_style)
        ],
        [
            Paragraph("<b>Requested Warehouse:</b>", normal_style), Paragraph(get_val("warehouse_name", ""), normal_style),
            Paragraph("<b>Ref. PO:</b>", normal_style), Paragraph(get_val("reference_po", "N/A"), normal_style)
        ]
    ]
    
    info_table = Table(general_info, colWidths=[110, 140, 110, 144])
    info_table.setStyle(TableStyle([
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('BACKGROUND', (0,0), (0,-1), colors.HexColor("#F7FAFC")),
        ('BACKGROUND', (2,0), (2,-1), colors.HexColor("#F7FAFC")),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 15))

    # Warehouse details POC
    story.append(Paragraph("Warehouse & Location POC", section_title_style))
    poc_info = [
        [
            Paragraph("<b>Warehouse POC Name:</b>", normal_style), Paragraph(get_val("warehouse_poc_name", "N/A"), normal_style),
            Paragraph("<b>Warehouse POC Mobile:</b>", normal_style), Paragraph(get_val("warehouse_poc_mobile", "N/A"), normal_style)
        ],
        [
            Paragraph("<b>Warehouse POC Phone:</b>", normal_style), Paragraph(get_val("additional_poc_mobile", "N/A"), normal_style),
            Paragraph("<b>Delivery Location:</b>", normal_style), Paragraph(get_val("location", "N/A"), normal_style)
        ],
        [
            Paragraph("<b>Purpose:</b>", normal_style), Paragraph(get_val("purpose", "N/A"), normal_style),
            Paragraph("", normal_style), Paragraph("", normal_style)
        ]
    ]
    poc_table = Table(poc_info, colWidths=[120, 130, 120, 134])
    poc_table.setStyle(TableStyle([
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('BACKGROUND', (0,0), (0,-1), colors.HexColor("#F7FAFC")),
        ('BACKGROUND', (2,0), (2,-1), colors.HexColor("#F7FAFC")),
    ]))
    story.append(poc_table)
    story.append(Spacer(1, 15))

    # Line Items
    story.append(Paragraph("Material Line Items", section_title_style))
    last_col_header = "Cost Center" if issue_type == "cost_center" else "WBS Element"
    items_header = [
        Paragraph("SN", table_header_style),
        Paragraph("Material Code / Part #", table_header_style),
        Paragraph("Description", table_header_style),
        Paragraph("UOM", table_header_style),
        Paragraph("Req Qty", table_header_style),
        Paragraph("App Qty", table_header_style),
        Paragraph("Issued Qty", table_header_style),
        Paragraph(last_col_header, table_header_style)
    ]
    
    table_data = [items_header]
    for idx, item in enumerate(mrf_data.get("line_items", [])):
        last_col_val = get_val("cost_center_code", "N/A") if issue_type == "cost_center" else (item.get("wbs_code") or "")
        table_data.append([
            Paragraph(str(idx + 1), normal_style),
            Paragraph(str(item.get("material_code") or ""), normal_style),
            Paragraph(str(item.get("description") or ""), normal_style),
            Paragraph(str(item.get("uom") or ""), normal_style),
            Paragraph(str(item.get("requested_qty") or 0.0), normal_style),
            Paragraph(str(item.get("approved_qty") or 0.0), normal_style),
            Paragraph(str(item.get("issued_qty") or 0.0), normal_style),
            Paragraph(str(last_col_val), normal_style)
        ])
    
    # Column width sizing: total letter width with margin is 504 pt.
    items_table = Table(table_data, colWidths=[25, 100, 134, 35, 45, 45, 45, 75])
    items_table.setStyle(TableStyle([
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E0")),
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#2C5282")),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(items_table)
    story.append(Spacer(1, 15))

    # Transport / Dispatch Details
    story.append(Paragraph("Transportation & Dispatch Details", section_title_style))
    trans_info = [
        [
            Paragraph("<b>Vehicle Number:</b>", normal_style), Paragraph(get_val("vehicle_number", "Pending"), normal_style),
            Paragraph("<b>Driver Name:</b>", normal_style), Paragraph(get_val("driver_name", "Pending"), normal_style)
        ],
        [
            Paragraph("<b>Driver Mobile:</b>", normal_style), Paragraph(get_val("driver_mobile", "Pending"), normal_style),
            Paragraph("<b>Driver Iqama:</b>", normal_style), Paragraph(get_val("driver_iqama", "Pending"), normal_style)
        ],
        [
            Paragraph("<b>Transport Company:</b>", normal_style), Paragraph(get_val("transport_company", "Pending"), normal_style),
            Paragraph("<b>Receiver Name/Mobile:</b>", normal_style), Paragraph(f"{get_val('receiver_name','Pending')} / {get_val('receiver_mobile','')}", normal_style)
        ]
    ]
    trans_table = Table(trans_info, colWidths=[120, 130, 120, 134])
    trans_table.setStyle(TableStyle([
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('BACKGROUND', (0,0), (0,-1), colors.HexColor("#F7FAFC")),
        ('BACKGROUND', (2,0), (2,-1), colors.HexColor("#F7FAFC")),
    ]))
    story.append(trans_table)
    story.append(Spacer(1, 20))

    # Approvals & Signatures section
    story.append(Paragraph("Approvals & Signatures History", section_title_style))
    
    # Helper to check signature or write sign status
    def get_sign_status(sig_str, name, role):
        if sig_str:
            return f"Signed by {name or role} [APPROVED]"
        return "Pending / Not Required"

    signature_info = [
        [
            Paragraph("<b>Requestor/Project Manager:</b>", normal_style), Paragraph(get_val("requestor_manager_name", "N/A"), normal_style),
            Paragraph("<b>Email / Status:</b>", normal_style), Paragraph(f"{get_val('requestor_manager_email', 'N/A')} / {get_sign_status(mrf_data.get('requestor_manager_signature'), mrf_data.get('requestor_manager_name'), 'Requestor/Project Manager')}", normal_style)
        ],
        [
            Paragraph("<b>Warehouse Supervisor:</b>", normal_style), Paragraph(get_val("supervisor_name", "N/A"), normal_style),
            Paragraph("<b>Status:</b>", normal_style), Paragraph(get_sign_status(mrf_data.get("supervisor_signature"), mrf_data.get("supervisor_name"), "Warehouse Supervisor"), normal_style)
        ],
        [
            Paragraph("<b>Warehouse Manager:</b>", normal_style), Paragraph(get_val("manager_name", "N/A"), normal_style),
            Paragraph("<b>Status:</b>", normal_style), Paragraph(get_sign_status(mrf_data.get("manager_signature"), mrf_data.get("manager_name"), "Warehouse Manager"), normal_style)
        ],
        [
            Paragraph("<b>Issued By (Warehouse Worker):</b>", normal_style), Paragraph(get_val("worker_name", "N/A"), normal_style),
            Paragraph("<b>Status:</b>", normal_style), Paragraph(get_sign_status(mrf_data.get("worker_signature"), mrf_data.get("worker_name"), "Warehouse Worker"), normal_style)
        ],
        [
            Paragraph("<b>Receiver Name:</b>", normal_style), Paragraph(get_val("receiver_name", "N/A"), normal_style),
            Paragraph("<b>Receiver Signature:</b>", normal_style), Paragraph("___________________________", normal_style)
        ]
    ]
    
    sig_table = Table(signature_info, colWidths=[120, 130, 120, 134])
    sig_table.setStyle(TableStyle([
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('BACKGROUND', (0,0), (0,-1), colors.HexColor("#F8FAFC")),
        ('BACKGROUND', (2,0), (2,-1), colors.HexColor("#F8FAFC")),
    ]))
    story.append(sig_table)

    # Build PDF using our custom Watermark Canvas
    def build_canvas(filename, *args, **kwargs):
        c = WatermarkCanvas(filename, *args, **kwargs)
        c.is_cancelled = cancelled
        c.doc_number = get_val("reference_number", "MRF-Form")
        return c

    doc.build(story, canvasmaker=build_canvas)


def generate_receiving_pdf(receiving_data: dict, file_path: str, cancelled: bool = False):
    """
    Generates a PDF for Material Receiving Form
    """
    def get_val(key, default=""):
        val = receiving_data.get(key)
        return str(val) if val is not None else default

    doc = SimpleDocTemplate(
        file_path, 
        pagesize=letter,
        rightMargin=54,
        leftMargin=54,
        topMargin=72,
        bottomMargin=72
    )
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#234E52"),
        spaceAfter=15
    )
    
    section_title_style = ParagraphStyle(
        'SectionTitle',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor("#2C5282"),
        spaceBefore=10,
        spaceAfter=6
    )
    
    normal_style = ParagraphStyle(
        'DocNormal',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#2D3748")
    )
    
    table_header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=11,
        textColor=colors.white
    )

    company_style = ParagraphStyle(
        'CompanyTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=colors.HexColor("#2C5282")
    )

    story = []

    # Company Logo and Name Header
    logo_base64 = receiving_data.get("company_logo")
    company_name = receiving_data.get("company_name", "WAREHOUSE")
    logo_flowable = None
    if logo_base64:
        try:
            if "," in logo_base64:
                logo_base64 = logo_base64.split(",")[1]
            img_data = base64.b64decode(logo_base64)
            img_buf = io.BytesIO(img_data)
            reader = ImageReader(img_buf)
            w, h = reader.getSize()
            scale = 35.0 / h
            logo_flowable = Image(img_buf, width=w*scale, height=35.0)
        except Exception as e:
            print(f"Failed to generate logo: {e}")

    company_text = Paragraph(company_name, company_style)
    if logo_flowable:
        header_table = Table([[logo_flowable, company_text]], colWidths=[50, 454])
        header_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 10),
        ]))
        story.append(header_table)
    else:
        story.append(company_text)
        story.append(Spacer(1, 10))

    story.append(Paragraph("MATERIAL RECEIVING FORM", title_style))
    story.append(Spacer(1, 10))

    general_info = [
        [
            Paragraph("<b>Receiving Number:</b>", normal_style), Paragraph(get_val("receiving_number", ""), normal_style),
            Paragraph("<b>Date:</b>", normal_style), Paragraph(get_val("received_date", ""), normal_style)
        ],
        [
            Paragraph("<b>Supplier:</b>", normal_style), Paragraph(get_val("supplier", "N/A"), normal_style),
            Paragraph("<b>Reference (PO/DN):</b>", normal_style), Paragraph(get_val("reference_number", "N/A"), normal_style)
        ],
        [
            Paragraph("<b>Received By:</b>", normal_style), Paragraph(get_val("received_by", ""), normal_style),
            Paragraph("<b>Checked By:</b>", normal_style), Paragraph(get_val("checked_by", "N/A"), normal_style)
        ],
        [
            Paragraph("<b>Type:</b>", normal_style), Paragraph(get_val("type", ""), normal_style),
            Paragraph("<b>Status:</b>", normal_style), Paragraph(get_val("status", "Received"), normal_style)
        ]
    ]
    info_table = Table(general_info, colWidths=[110, 140, 110, 144])
    info_table.setStyle(TableStyle([
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('BACKGROUND', (0,0), (0,-1), colors.HexColor("#F7FAFC")),
        ('BACKGROUND', (2,0), (2,-1), colors.HexColor("#F7FAFC")),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 15))

    # Items table
    story.append(Paragraph("Received Items", section_title_style))
    headers = [
        Paragraph("SN", table_header_style),
        Paragraph("Material Code", table_header_style),
        Paragraph("Plant", table_header_style),
        Paragraph("Storage Location", table_header_style),
        Paragraph("WBS Element", table_header_style),
        Paragraph("Qty Received", table_header_style),
        Paragraph("Remarks", table_header_style)
    ]
    table_data = [headers]
    for idx, item in enumerate(receiving_data.get("line_items", [])):
        table_data.append([
            Paragraph(str(idx + 1), normal_style),
            Paragraph(str(item.get("material_code") or ""), normal_style),
            Paragraph(str(item.get("plant_code") or ""), normal_style),
            Paragraph(str(item.get("storage_location_code") or ""), normal_style),
            Paragraph(str(item.get("wbs_code") or "N/A"), normal_style),
            Paragraph(str(item.get("quantity") or 0.0), normal_style),
            Paragraph(str(item.get("remarks") or ""), normal_style)
        ])
    
    items_table = Table(table_data, colWidths=[30, 90, 60, 80, 80, 64, 100])
    items_table.setStyle(TableStyle([
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E0")),
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#234E52")),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(items_table)
    
    if receiving_data.get("remarks"):
        story.append(Spacer(1, 15))
        story.append(Paragraph("<b>Remarks:</b>", normal_style))
        story.append(Paragraph(str(receiving_data.get("remarks")), normal_style))

    def build_canvas(filename, *args, **kwargs):
        c = WatermarkCanvas(filename, *args, **kwargs)
        c.is_cancelled = cancelled
        c.doc_number = get_val("receiving_number", "MR-Form")
        return c

    doc.build(story, canvasmaker=build_canvas)


def generate_transfer_pdf(transfer_data: dict, file_path: str, cancelled: bool = False):
    """
    Generates a PDF for Material Transfer Form
    """
    def get_val(key, default=""):
        val = transfer_data.get(key)
        return str(val) if val is not None else default

    doc = SimpleDocTemplate(
        file_path, 
        pagesize=letter,
        rightMargin=54,
        leftMargin=54,
        topMargin=72,
        bottomMargin=72
    )
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#7B341E"),
        spaceAfter=15
    )
    
    section_title_style = ParagraphStyle(
        'SectionTitle',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor("#2C5282"),
        spaceBefore=10,
        spaceAfter=6
    )
    
    normal_style = ParagraphStyle(
        'DocNormal',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#2D3748")
    )
    
    table_header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=11,
        textColor=colors.white
    )

    story = []
    story.append(Paragraph("MATERIAL TRANSFER FORM", title_style))
    story.append(Spacer(1, 10))

    general_info = [
        [
            Paragraph("<b>Transfer Number:</b>", normal_style), Paragraph(get_val("transfer_number", ""), normal_style),
            Paragraph("<b>Requested By:</b>", normal_style), Paragraph(get_val("requested_by", ""), normal_style)
        ],
        [
            Paragraph("<b>Source Plant:</b>", normal_style), Paragraph(get_val("source_plant", ""), normal_style),
            Paragraph("<b>Destination Plant:</b>", normal_style), Paragraph(get_val("dest_plant", ""), normal_style)
        ],
        [
            Paragraph("<b>Source Storage Loc:</b>", normal_style), Paragraph(get_val("source_storage_location", ""), normal_style),
            Paragraph("<b>Destination Storage Loc:</b>", normal_style), Paragraph(get_val("dest_storage_location", ""), normal_style)
        ],
        [
            Paragraph("<b>Source WBS:</b>", normal_style), Paragraph(get_val("source_wbs", "N/A"), normal_style),
            Paragraph("<b>Destination WBS:</b>", normal_style), Paragraph(get_val("dest_wbs", "N/A"), normal_style)
        ],
        [
            Paragraph("<b>Status:</b>", normal_style), Paragraph(get_val("status", ""), normal_style),
            Paragraph("<b>Approved By:</b>", normal_style), Paragraph(get_val("approved_by", "Pending"), normal_style)
        ]
    ]
    info_table = Table(general_info, colWidths=[110, 140, 110, 144])
    info_table.setStyle(TableStyle([
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('BACKGROUND', (0,0), (0,-1), colors.HexColor("#F7FAFC")),
        ('BACKGROUND', (2,0), (2,-1), colors.HexColor("#F7FAFC")),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 15))

    story.append(Paragraph("Transferred Items", section_title_style))
    headers = [
        Paragraph("SN", table_header_style),
        Paragraph("Material Code", table_header_style),
        Paragraph("Quantity Transferred", table_header_style)
    ]
    table_data = [headers]
    for idx, item in enumerate(transfer_data.get("line_items", [])):
        table_data.append([
            Paragraph(str(idx + 1), normal_style),
            Paragraph(str(item.get("material_code") or ""), normal_style),
            Paragraph(str(item.get("quantity") or 0.0), normal_style)
        ])
    
    items_table = Table(table_data, colWidths=[50, 254, 200])
    items_table.setStyle(TableStyle([
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E0")),
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#7B341E")),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(items_table)

    if transfer_data.get("remarks"):
        story.append(Spacer(1, 15))
        story.append(Paragraph("<b>Remarks:</b>", normal_style))
        story.append(Paragraph(str(transfer_data.get("remarks")), normal_style))

    def build_canvas(filename, *args, **kwargs):
        c = WatermarkCanvas(filename, *args, **kwargs)
        c.is_cancelled = cancelled
        c.doc_number = get_val("transfer_number", "TR-Form")
        return c

    doc.build(story, canvasmaker=build_canvas)
