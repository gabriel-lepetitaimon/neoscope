import streamlit as st

from neoscope.image_viewer import ImageViewer
from neoscope.utils.image import checkerboard

st.set_page_config(layout="wide")
st.title("Image Viewer Widget Example")

with st.container(horizontal=True):
    view1 = ImageViewer(image=checkerboard((100, 100)))
    view1.streamlit(key="view1")

    view2 = ImageViewer(image=checkerboard((100, 100), color2="green"))
    view2.streamlit(key="view2")
