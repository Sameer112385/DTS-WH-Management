import pandas as pd
from typing import List, Dict, Any, Tuple
import os

REQUIRED_COLUMNS = [
    "Material", "Plant", "Storage Location", "Special Stock", "Spec. stk valuation",
    "Special stock number", "DF stor. loc. level", "Base Unit of Measure", "Unrestricted",
    "Stock Segment", "Currency", "Value Unrestricted", "Transit and Transfer",
    "Val. in Trans./Tfr", "Quality Inspection", "Value in QualInsp.", "Restricted-Use Stock",
    "Value Restricted", "Blocked", "Value BlockedStock", "Returns", "Value Rets Blocked",
    "Material Description", "Name 1", "Material Type", "Material Group",
    "Descr. of Storage Loc.", "Valuated Goods Receipt Blocked Stock", "Val. GR Blocked St.",
    "Tied Empties", "Val. Tied Empties", "Stock in Transit", "Value in Transit",
    "In transfer (plant)", "Value in Stock Tfr", "Customer", "WBS Element"
]

def parse_mb52_excel(file_path: str) -> Tuple[bool, str, List[Dict[str, Any]]]:
    """
    Parses an MB52 Excel report and returns: (success_bool, message, list_of_records)
    """
    if not os.path.exists(file_path):
        return False, "File does not exist.", []
    
    try:
        # Load excel file
        # Check sheet name or default to first sheet
        df = pd.read_excel(file_path)
        
        # Strip whitespaces from column headers
        df.columns = [str(col).strip() for col in df.columns]
        
        # Check missing columns
        missing_cols = [col for col in REQUIRED_COLUMNS if col not in df.columns]
        if missing_cols:
            return False, f"Missing required columns in MB52 report: {', '.join(missing_cols)}", []
        
        records = []
        for index, row in df.iterrows():
            # Clean and parse material data
            material_code = str(row["Material"]).strip()
            if not material_code or pd.isna(row["Material"]):
                continue # Skip empty rows
                
            plant = str(row["Plant"]).strip()
            storage_location = str(row["Storage Location"]).strip()
            # If Storage Location is NaN, default to empty or main
            if pd.isna(row["Storage Location"]):
                storage_location = ""
            
            wbs = str(row["WBS Element"]).strip()
            if pd.isna(row["WBS Element"]) or wbs.lower() in ["nan", "null", ""]:
                wbs = ""
                
            description = str(row["Material Description"]).strip() if not pd.isna(row["Material Description"]) else ""
            uom = str(row["Base Unit of Measure"]).strip() if not pd.isna(row["Base Unit of Measure"]) else "EA"
            m_type = str(row["Material Type"]).strip() if not pd.isna(row["Material Type"]) else ""
            m_group = str(row["Material Group"]).strip() if not pd.isna(row["Material Group"]) else ""
            
            # Numeric fields conversion (fill nan with 0.0)
            def clean_float(val):
                try:
                    if pd.isna(val):
                        return 0.0
                    if isinstance(val, str):
                        # clean up currency symbols, commas
                        val = val.replace(",", "").strip()
                    return float(val)
                except Exception:
                    return 0.0
            
            unrestricted = clean_float(row["Unrestricted"])
            blocked = clean_float(row["Blocked"])
            quality_inspection = clean_float(row["Quality Inspection"])
            transit_and_transfer = clean_float(row["Transit and Transfer"])
            value_unrestricted = clean_float(row["Value Unrestricted"])
            
            records.append({
                "material_code": material_code,
                "description": description,
                "uom": uom,
                "material_type": m_type,
                "material_group": m_group,
                "plant": plant,
                "storage_location": storage_location,
                "wbs": wbs,
                "available_qty": unrestricted,
                "blocked_qty": blocked,
                "quality_inspection_qty": quality_inspection,
                "transit_qty": transit_and_transfer,
                "stock_value": value_unrestricted
            })
            
        return True, f"Successfully parsed {len(records)} records.", records
        
    except Exception as e:
        return False, f"Failed to parse MB52 Excel report: {str(e)}", []
