import streamlit as st
from streamlit_anywidget import anywidget

from neoscope.base import HelloButtonModel
from neoscope.image_viewer import ImageViewer
from neoscope.utils.image import checkerboard

st.title("Counter Widget Example")
counter = HelloButtonModel()
counter_state = counter.streamlit(key="counter")

view = ImageViewer(image=checkerboard((100, 100)))
view.streamlit(key="image_viewer")


# Interact with the widget state
st.write(f"Current value 2: {counter.value}")

# Show debug info
with st.expander("Module Counter Debug Info"):
    st.write("Module-based Counter State:", counter_state)
    st.json({"module_counter_value": counter.value})
